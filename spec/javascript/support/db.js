export async function clearDb(db) {
  await Promise.all(db.tables.map((table) => table.clear()))
}
