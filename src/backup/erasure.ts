/**
 * B6: what stays elsewhere once a course is erased from the backup, as
 * Impostazioni states it (owner decision 17, docs/working/OWNER_DECISIONS.md).
 * The server deletes the course at once; the database provider's automatic
 * daily backups keep a copy until they expire (Supabase Pro: 7 days), and
 * the sync service drops the erased rows' history at its daily compaction
 * (PowerSync Cloud).
 */
export const PROVIDER_BACKUP_DAYS = 7

export const ERASURE_RETENTION_TEXT = `Eliminando il corso lo elimini anche dal backup online. Le copie di sicurezza automatiche del fornitore lo conservano ancora per al massimo ${PROVIDER_BACKUP_DAYS} giorni, poi spariscono.`
