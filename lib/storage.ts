type SavedKey = `codepace:${string}`;

const legacyKey = (key: SavedKey) => key.replace(/^codepace:/, "keylane:");

export function readSavedValue(
  storage: Pick<Storage, "getItem">,
  key: SavedKey,
) {
  return storage.getItem(key) ?? storage.getItem(legacyKey(key));
}

export function removeSavedValue(
  storage: Pick<Storage, "removeItem">,
  key: SavedKey,
) {
  storage.removeItem(key);
  storage.removeItem(legacyKey(key));
}
