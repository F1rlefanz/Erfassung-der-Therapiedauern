/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL des lokalen On-Premise-Sync-Servers (Default: http://localhost:3001). */
  readonly VITE_SYNC_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
