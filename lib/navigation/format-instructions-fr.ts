interface OsrmManeuverLike {
  type?: string;
  modifier?: string;
  exit?: number;
}

interface OsrmStepLike {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: OsrmManeuverLike;
}

function normalizeStreetName(name?: string): string {
  const clean = (name ?? '').trim();
  return clean ? ` sur ${clean}` : '';
}

function directionFromModifier(modifier?: string): string {
  switch (modifier) {
    case 'left':
      return 'a gauche';
    case 'right':
      return 'a droite';
    case 'slight left':
      return 'legerement a gauche';
    case 'slight right':
      return 'legerement a droite';
    case 'sharp left':
      return 'fort a gauche';
    case 'sharp right':
      return 'fort a droite';
    case 'uturn':
      return 'demi-tour';
    case 'straight':
      return 'tout droit';
    default:
      return 'tout droit';
  }
}

export function formatInstructionFr(step: OsrmStepLike): string {
  const maneuver = step.maneuver ?? {};
  const type = maneuver.type ?? 'continue';
  const modifier = maneuver.modifier;
  const street = normalizeStreetName(step.name);

  if (type === 'depart') {
    return `Demarrez${street}`;
  }

  if (type === 'arrive') {
    return 'Vous etes arrive a destination';
  }

  if (type === 'roundabout' || type === 'rotary') {
    const exit = typeof maneuver.exit === 'number' ? `, sortie ${maneuver.exit}` : '';
    return `Prenez le rond-point${exit}${street}`;
  }

  if (type === 'merge') {
    return `Inserez-vous${street}`;
  }

  if (type === 'fork') {
    return `Restez ${directionFromModifier(modifier)}${street}`;
  }

  if (type === 'on ramp') {
    return `Prenez la bretelle${street}`;
  }

  if (type === 'off ramp') {
    return `Sortez${street}`;
  }

  if (type === 'end of road') {
    return `Au bout, tournez ${directionFromModifier(modifier)}${street}`;
  }

  if (type === 'new name') {
    return `Continuez${street}`;
  }

  if (type === 'continue') {
    return `Continuez ${directionFromModifier(modifier)}${street}`;
  }

  if (type === 'turn') {
    return `Tournez ${directionFromModifier(modifier)}${street}`;
  }

  return `Continuez${street}`;
}
