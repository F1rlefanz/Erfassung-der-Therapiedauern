// js/utils/exportUtils.js
import { formatDateForInput } from './dateUtils.js';
import { db } from '../dbConfig.js';
import { state } from '../state.js';

/**
 * Hauptexport-Funktion
 */
export async function exportData() {
    try {
        const params = getExportParams();
        const data = await collectExportData(params);

        if (Object.keys(data).length === 0) {
            throw new Error('Keine Daten zum Exportieren gefunden');
        }

        await executeExport(params.format, data);
        showSuccessMessage('Export erfolgreich');
    } catch (error) {
        console.error('Error exporting data:', error);
        showErrorMessage('Fehler beim Exportieren der Daten: ' + error.message);
    }
}

/**
 * Sammelt die Export-Parameter aus den Formular-Elementen
 */
function getExportParams() {
    return {
        format: document.getElementById('export-format').value,
        startDate: state.startDateInput.value,
        endDate: state.endDateInput.value,
        filterDuration: state.filterDurationInput.value ? 
            parseInt(state.filterDurationInput.value, 10) : null,
        filterTreatment: state.filterTreatmentInput.value
    };
}

/**
 * Sammelt die zu exportierenden Daten
 */
async function collectExportData({ startDate, endDate, filterDuration, filterTreatment }) {
    const data = {};
    let currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);
    const therapyTypes = await db.getActiveTherapyTypes();

    while (currentDate <= endDateTime) {
        const dateStr = formatDateForInput(currentDate);
        const dateData = {};

        for (const therapy of therapyTypes) {
            if (filterTreatment && therapy.id !== filterTreatment) continue;

            const entry = await db.getDailyEntry(dateStr, therapy.id);
            if (entry?.patients?.length > 0) {
                const patients = filterDuration ?
                    entry.patients.filter(p => p.hours.filter(h => h).length >= filterDuration) :
                    entry.patients;

                if (patients.length > 0) {
                    dateData[therapy.id] = patients;
                }
            }
        }

        if (Object.keys(dateData).length > 0) {
            data[dateStr] = dateData;
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
}

/**
 * Führt den Export im gewählten Format durch
 */
async function executeExport(format, data) {
    switch (format) {
        case 'csv':
            await exportToCSV(data);
            break;
        case 'pdf':
            await exportToPDF(data);
            break;
        case 'json':
            await exportToJSON(data);
            break;
        case 'db':
            await exportToDB(data);
            break;
        default:
            throw new Error(`Unbekanntes Export-Format: ${format}`);
    }
}

/**
 * Export als CSV
 */
async function exportToCSV(data) {
    try {
        const therapyTypes = await db.getActiveTherapyTypes();
        let csvContent = "data:text/csv;charset=utf-8,";

        for (const date of Object.keys(data)) {
            csvContent += `\nDatum: ${date}\n`;
            
            for (const therapy of therapyTypes) {
                if (data[date][therapy.id]) {
                    csvContent += `\n${therapy.displayName}\n`;
                    csvContent += `Fallnummer,Name,${Array.from({ length: 24 }, (_, i) => `Stunde ${i}`).join(',')},Gesamtzeit\n`;

                    data[date][therapy.id].forEach(patient => {
                        const totalHours = patient.hours.filter(h => h).length;
                        csvContent += `${patient.caseNumber},${patient.name},${patient.hours.map(h => h ? 'Ja' : 'Nein').join(',')},${totalHours}\n`;
                    });

                    const totalDayHours = data[date][therapy.id].reduce((sum, patient) => 
                        sum + patient.hours.filter(h => h).length, 0);
                    csvContent += `Gesamtzeit aller Patienten:,${totalDayHours} Stunden\n`;
                }
            }
        }

        downloadFile(csvContent, 'Therapiedauer_Erfassung.csv');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        throw new Error('Fehler beim CSV-Export: ' + error.message);
    }
}

/**
 * Export als PDF
 */
async function exportToPDF(data) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const therapyTypes = await db.getActiveTherapyTypes();
        const pageHeight = doc.internal.pageSize.height;

        // Dokumentenkopf
        doc.setFont("helvetica");
        doc.setFontSize(18);
        doc.text("Erfassung der Therapiedauer", 10, 10);
        doc.setFontSize(10);
        doc.text(`Exportiert am: ${formatDateForInput(new Date())}`, 10, 20);

        let yPosition = 30;

        // Daten für jeden Tag
        for (const date of Object.keys(data)) {
            // Neue Seite wenn nötig
            if (yPosition > pageHeight - 40) {
                doc.addPage();
                yPosition = 30;
            }

            doc.setFontSize(14);
            doc.text(`Datum: ${date}`, 10, yPosition);
            yPosition += 10;

            for (const therapy of therapyTypes) {
                if (data[date][therapy.id]) {
                    if (yPosition > pageHeight - 60) {
                        doc.addPage();
                        yPosition = 30;
                    }

                    doc.setFontSize(12);
                    doc.text(therapy.displayName, 10, yPosition);
                    yPosition += 10;

                    const headers = [
                        "Nummer", "Name", 
                        ...Array.from({ length: 24 }, (_, i) => i.toString()),
                        "Gesamtzeit"
                    ];

                    const rows = data[date][therapy.id].map(patient => {
                        const totalHours = patient.hours.filter(h => h).length;
                        return [
                            patient.caseNumber,
                            patient.name,
                            ...patient.hours.map(h => h ? 'Ja' : 'Nein'),
                            totalHours
                        ];
                    });

                    const totalHours = rows.reduce((sum, row) => sum + parseInt(row[row.length-1]), 0);
                    rows.push(["", "", ...Array(24).fill(""), `Gesamtzeit: ${totalHours} Stunden`]);

                    doc.autoTable({
                        startY: yPosition,
                        head: [headers],
                        body: rows,
                        theme: 'grid',
                        styles: { fontSize: 8, cellPadding: 2 }
                    });

                    yPosition = doc.lastAutoTable.finalY + 20;
                }
            }
        }

        // Fußzeile
        doc.setFontSize(10);
        doc.text("© 2024 Erfassung der Therapiedauer", 10, pageHeight - 10);

        doc.save('Therapiedauer_Erfassung.pdf');
    } catch (error) {
        console.error('Error exporting PDF:', error);
        throw new Error('Fehler beim PDF-Export: ' + error.message);
    }
}

/**
 * Export als JSON
 */
async function exportToJSON(data) {
    try {
        const jsonContent = JSON.stringify(data, null, 2);
        downloadFile(
            'data:application/json;charset=utf-8,' + encodeURIComponent(jsonContent),
            'Therapiedauer_Erfassung.json'
        );
    } catch (error) {
        console.error('Error exporting JSON:', error);
        throw new Error('Fehler beim JSON-Export: ' + error.message);
    }
}

/**
 * Export als SQLite Datenbank
 */
async function exportToDB(data) {
    try {
        const SQL = await initSqlJs({ locateFile: file => `js/wasm/sql-wasm.wasm` });
        const db = new SQL.Database();

        // Tabelle erstellen
        db.run(`CREATE TABLE data (
            date TEXT,
            therapyType TEXT,
            caseNumber TEXT,
            name TEXT,
            hours TEXT,
            totalHours INTEGER,
            PRIMARY KEY (date, therapyType, caseNumber)
        )`);

        // Daten einfügen
        for (const date of Object.keys(data)) {
            for (const [therapyType, patients] of Object.entries(data[date])) {
                patients.forEach(patient => {
                    const hours = patient.hours.map(h => h ? 'Ja' : 'Nein').join(',');
                    const totalHours = patient.hours.filter(h => h).length;
                    
                    db.run(
                        "INSERT INTO data (date, therapyType, caseNumber, name, hours, totalHours) VALUES (?, ?, ?, ?, ?, ?)",
                        [date, therapyType, patient.caseNumber, patient.name, hours, totalHours]
                    );
                });
            }
        }

        // Download
        const binaryArray = db.export();
        const blob = new Blob([binaryArray], { type: 'application/octet-stream' });
        downloadFile(URL.createObjectURL(blob), 'Therapiedauer_Erfassung.db');
    } catch (error) {
        console.error('Error exporting DB:', error);
        throw new Error('Fehler beim DB-Export: ' + error.message);
    }
}

/**
 * Hilfsfunktion zum Herunterladen von Dateien
 */
function downloadFile(content, filename) {
    const link = document.createElement('a');
    link.setAttribute('href', content);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Zeigt eine Erfolgsmeldung an
 */
function showSuccessMessage(message) {
    showMessage(message, 'success-message');
}

/**
 * Zeigt eine Fehlermeldung an
 */
function showErrorMessage(message) {
    showMessage(message, 'error-message');
}

/**
 * Zeigt eine Nachricht in der UI an
 */
function showMessage(message, className) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.classList.add('fade-out');
        setTimeout(() => messageElement.remove(), 300);
    }, 3000);
}