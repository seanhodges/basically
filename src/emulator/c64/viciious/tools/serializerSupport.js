const registry = {};

export function addToSerializerRegistry(obj) {
  for (let fnName in obj) {

    // basically patch: overwrite rather than throw on re-registration. viciious
    // is a single-instance machine (its modules hold state in module-level
    // `let`s, and this registry is module-level too). The IDE legitimately
    // re-runs `bringup` within one page — a fresh emulator each Run / dialect
    // switch — which re-registers these names. The registry is only read by
    // serialize/deserialize, which the IDE never calls, so overwriting the
    // stale closures is harmless. (Upstream threw here, and its message even
    // referenced an undefined `name`, so the check never reported usefully.)
    registry[fnName] = obj[fnName];
  }
}

export function functionToReference(fn) {
  if (fn === null) return null;

  // This could alternatively be done with a Map where the keys are functions,
  // but it's such an infrequently-called helper, why spend the extra memory?
  for (let i in registry) {
    if (registry[i] === fn) return i;
  }

  console.error("Serializer registry has no entry for function:", fn);
  throw new Error(`Serializer registry has no entry for function`);
}

export function referenceToFunction(name) {
  if (name === null) return null;

  if (registry[name] === undefined) {
    throw new Error(`Serializer registry has no entry for a function named ${name}`);
  }

  return registry[name];
}
