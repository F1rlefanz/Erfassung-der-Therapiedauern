// js/exports/services/DataCollector.js

import { DataType } from '../interfaces/ExportTypes.js';
import { db } from '../../dbConfig.js';

/**
 * Service zum Sammeln von Daten für den Export
 */
export class DataCollector {
  // Cache für häufig verwendete Daten
  #therapyTypesCache = null;
  
  /**
   * Sammelt alle angeforderten Daten basierend auf den Export-Optionen
   */
  async collectData(options) {
    if (!options?.dateRange?.from || !options?.dateRange?.to) {
      throw new Error('Ungültiger Datumsbereich für Datensammlung');
    }

    try {
      const data = {
        metadata: this.#createMetadata(options),
        data: await this.#collectSelectedData(options)
      };

      return this.#validateCollectedData(data);

    } catch (error) {
      console.error('Fehler bei Datensammlung:', error);
      throw new Error(`Datensammlung fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Erstellt Metadaten für den Export
   */
  #createMetadata(options) {
    return {
      exportDate: new Date().toISOString(),
      timerange: {
        from: options.dateRange.from.toISOString(),
        to: options.dateRange.to.toISOString()
      },
      exportedTypes: Object.entries(options.dataTypes)
        .filter(([_, value]) => value)
        .map(([key]) => key)
    };
  }

  /**
   * Sammelt nur die ausgewählten Datentypen
   */
  async #collectSelectedData(options) {
    const collectors = {
      [DataType.THERAPY_STATS]: () => this.#collectTherapyStats(options),
      [DataType.ICU_STATS]: () => this.#collectICUStats(options),
      [DataType.IMC_STATS]: () => this.#collectIMCStats(options),
      [DataType.RAW_DATA]: () => this.#collectRawData(options)
    };

    const collectedData = {};
    
    // Parallel sammeln der ausgewählten Datentypen
    const collectionPromises = Object.entries(options.dataTypes)
      .filter(([_, isSelected]) => isSelected)
      .map(async ([type]) => {
        const collector = collectors[type];
        if (collector) {
          collectedData[type] = await collector();
        }
      });

    await Promise.all(collectionPromises);
    return collectedData;
  }

  /**
   * Holt aktive Therapietypen (cached)
   */
  async #getTherapyTypes() {
    if (!this.#therapyTypesCache) {
      this.#therapyTypesCache = await db.getActiveTherapyTypes();
    }
    return this.#therapyTypesCache;
  }

  /**
   * Sammelt Statistiken für einen bestimmten Monat
   */
  async #collectMonthlyStats(year, month, therapyType) {
    const stats = await db.getMonthlyStatistics(year, month, therapyType);
    return stats?.statistics ? this.#formatStatistics(stats.statistics) : null;
  }

  /**
   * Formatiert Statistik-Objekte einheitlich
   */
  #formatStatistics(stats) {
    return {
      ...stats,
      uniqueCases: stats.uniqueCases?.length || 0,
      continuedCases: stats.continuedCases?.length || 0,
      completeDays: Math.floor(stats.totalHours / 24) || 0
    };
  }

  /**
   * Sammelt Therapiestatistiken (monatlich & jährlich)
   */
  async #collectTherapyStats(options) {
    const year = options.dateRange.from.getFullYear();
    const therapyTypes = await this.#getTherapyTypes();
    
    const monthlyPromises = therapyTypes.map(async therapy => {
      const monthlyStats = await Promise.all(
        Array.from({ length: 12 }, (_, i) => 
          this.#collectMonthlyStats(year, i + 1, therapy.id)
        )
      );
      
      return [therapy.id, monthlyStats.filter(Boolean)];
    });

    const yearlyPromises = therapyTypes.map(async therapy => {
      const yearStats = await db.getYearlyStatistics(year, therapy.id);
      return [therapy.id, yearStats?.statistics ? 
        this.#formatStatistics(yearStats.statistics) : null];
    });

    const [monthly, yearly] = await Promise.all([
      Promise.all(monthlyPromises),
      Promise.all(yearlyPromises)
    ]);

    return {
      monthly: Object.fromEntries(monthly.filter(([_, stats]) => stats.length)),
      yearly: Object.fromEntries(yearly.filter(([_, stats]) => stats))
    };
  }

  /**
   * Sammelt ICU Schweregradstatistiken
   */
  async #collectICUStats(options) {
    const year = options.dateRange.from.getFullYear();
    
    const monthlyPromises = Array.from({ length: 12 }, async (_, month) => {
      const [cases, tissPoints, ventStats, crrtStats, ecmoStats] = 
        await Promise.all([
          db.getFallbuchCasesMonthly(year, month + 1, 'ICU'),
          db.getTISS28PointsMonthly(year, month + 1, 'ICU'),
          this.#collectMonthlyStats(year, month + 1, 'beatmung'),
          this.#collectMonthlyStats(year, month + 1, 'crrt'),
          this.#collectMonthlyStats(year, month + 1, 'ila_ecmo')
        ]);

      return this.#createICUMonthData(month + 1, {
        cases, tissPoints, ventStats, crrtStats, ecmoStats
      });
    });

    return {
      monthly: await Promise.all(monthlyPromises)
    };
  }

  /**
   * Erstellt monatliche ICU-Daten
   */
  #createICUMonthData(month, { cases, tissPoints, ventStats, crrtStats, ecmoStats }) {
    const monthData = {
      month,
      cases: cases || 0,
      tissPoints: tissPoints || 0,
      tissPerCase: '0.0',
      startedVentDays: 0,
      completeVentDays: 0,
      ventHours: 0,
      ventPatients: 0,
      ventPercentage: '0.0',
      avgVentDuration: '0.0',
      crrtDays: 0,
      ecmoDays: 0
    };

    if (ventStats) {
      monthData.startedVentDays = ventStats.startedDays || 0;
      monthData.completeVentDays = ventStats.completeDays || 0;
      monthData.ventHours = ventStats.totalHours || 0;
      monthData.ventPatients = ventStats.uniqueCases || 0;
      
      if (monthData.cases > 0) {
        monthData.ventPercentage = 
          ((monthData.ventPatients / monthData.cases) * 100).toFixed(1);
      }
      
      if (monthData.ventPatients > 0) {
        monthData.avgVentDuration = 
          (monthData.startedVentDays / monthData.ventPatients).toFixed(1);
      }
    }

    if (crrtStats) {
      monthData.crrtDays = crrtStats.startedDays || 0;
    }

    if (ecmoStats) {
      monthData.ecmoDays = ecmoStats.startedDays || 0;
    }

    if (monthData.cases > 0 && monthData.tissPoints > 0) {
      monthData.tissPerCase = (monthData.tissPoints / monthData.cases).toFixed(1);
    }

    return monthData;
  }

  /**
   * Sammelt IMC Schweregradstatistiken
   */
  async #collectIMCStats(options) {
    const year = options.dateRange.from.getFullYear();
    
    const monthlyPromises = Array.from({ length: 12 }, async (_, month) => {
      const [cases, tissPoints] = await Promise.all([
        db.getFallbuchCasesMonthly(year, month + 1, 'IMC'),
        db.getTISS28PointsMonthly(year, month + 1, 'IMC')
      ]);

      return {
        month: month + 1,
        cases: cases || 0,
        tissPoints: tissPoints || 0,
        tissPerCase: cases > 0 ? (tissPoints / cases).toFixed(1) : '0.0'
      };
    });

    return {
      monthly: await Promise.all(monthlyPromises)
    };
  }

  /**
   * Sammelt Rohdaten der täglichen Einträge
   */
  async #collectRawData(options) {
    const therapyTypes = await this.#getTherapyTypes();
    const dailyEntries = {};
    
    for (const date of this.#dateRange(options.dateRange)) {
      const dateStr = date.toISOString().split('T')[0];
      const entries = await Promise.all(
        therapyTypes.map(async therapy => {
          const entry = await db.getDailyEntry(dateStr, therapy.id);
          return [therapy.id, entry?.patients || []];
        })
      );

      const dayData = Object.fromEntries(
        entries.filter(([_, patients]) => patients.length)
      );

      if (Object.keys(dayData).length) {
        dailyEntries[dateStr] = dayData;
      }
    }

    return { dailyEntries };
  }

  /**
   * Generator für Datumsbereich
   */
  *#dateRange({ from, to }) {
    const current = new Date(from);
    const end = new Date(to);
    
    while (current <= end) {
      yield new Date(current);
      current.setDate(current.getDate() + 1);
    }
  }

  /**
   * Validiert die gesammelten Daten
   */
  #validateCollectedData(data) {
    if (!data?.metadata || !data?.data) {
      throw new Error('Ungültige oder unvollständige Datenstruktur');
    }

    // Prüfe ob mindestens ein Datentyp Ergebnisse enthält
    const hasData = Object.values(data.data).some(value => {
      return value && Object.keys(value).length > 0;
    });

    if (!hasData) {
      throw new Error('Keine Daten für den gewählten Zeitraum gefunden');
    }

    return data;
  }

  // In TableFormatter.js nach den anderen format-Methoden ergänzen:

/**
 * Formatiert Rohdaten für tabellarische Darstellung
 * @param {Object} rawData - Die Rohdaten nach Datum/Therapie strukturiert
 * @returns {Object} Formatierte Tabellendaten mit headers und rows
 */
formatRawData(rawData) {
  const headers = [
      'Datum',
      'Therapieart', 
      'Fallnummer',
      'Name',
      'Behandlungsstunden',
      'Von',
      'Bis'
  ];

  const rows = [];
  
  Object.entries(rawData).forEach(([date, therapies]) => {
      Object.entries(therapies).forEach(([therapy, patients]) => {
          patients.forEach(patient => {
              // Aktive Stunden ermitteln
              const activeHours = patient.hours.reduce((acc, hour, index) => {
                  if (hour) acc.push(index);
                  return acc;
              }, []);

              // Therapieart übersetzen
              const therapyName = {
                  'beatmung': 'Beatmungsdauer',
                  'crrt': 'Nierenersatzverfahren',  
                  'ila_ecmo': 'Extrakorporale Lungenunterstützung'
              }[therapy] || therapy;

              // Zeile formatieren 
              rows.push([
                  this._formatDate(date),
                  therapyName,
                  patient.caseNumber || '-',
                  patient.name || '-',
                  this._formatNumber(activeHours.length),
                  activeHours.length ? `${String(activeHours[0]).padStart(2, '0')}:00` : '-',
                  activeHours.length ? `${String(activeHours[activeHours.length - 1]).padStart(2, '0')}:59` : '-'
              ]);
          });
      });
  });

  return { headers, rows };
}
}