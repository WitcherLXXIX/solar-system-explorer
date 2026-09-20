import { getBody, type BodyId } from '../catalog/bodies';
import { orbitalPeriodDays } from '../ephemeris/ephemeris';
import {
  formatDistance, formatHours, formatMass, formatPeriodDays, formatRadius, formatTemp,
} from '../format/format';
import { el } from './dom';

export function createInfoPanel(root: HTMLElement): { setBody(id: BodyId): void; update(sunDistanceM: number | null): void } {
  const heading = el('h2');
  const kind = el('p', 'dim');
  const list = el('dl', 'facts');
  const foot = el('p', 'dim small');
  root.append(heading, kind, list, foot);
  let sunDistanceValue: HTMLElement | null = null;

  const addRow = (label: string, value: string, title?: string): HTMLElement => {
    const dt = el('dt', '', label);
    const dd = el('dd', '', value);
    if (title) dd.title = title;
    list.append(dt, dd);
    return dd;
  };

  return {
    setBody(id) {
      const body = getBody(id);
      const period = orbitalPeriodDays(id);
      heading.textContent = body.name;
      kind.textContent = body.kind === 'star' ? 'Star (G2V)' : 'Planet';
      list.replaceChildren();
      addRow('Radius', formatRadius(body.radiusM), 'Volumetric mean radius');
      addRow('Mass', formatMass(body.massKg));
      addRow('Orbital period', period === null ? 'n/a' : formatPeriodDays(period), 'From astronomy-engine (VSOP87)');
      addRow('Day length', formatHours(body.rotationPeriodH), 'Sidereal rotation period');
      addRow('Axial tilt', `${body.axialTiltDeg}°`);
      addRow('Surface gravity', `${body.surfaceGravity.toFixed(1)} m/s²`);
      addRow('Mean temperature', formatTemp(body.meanTempK), body.tempNote);
      sunDistanceValue = addRow('Distance from Sun', '');
      foot.textContent = `Source: ${body.source}`;
    },
    update(sunDistanceM) {
      if (sunDistanceValue) sunDistanceValue.textContent = sunDistanceM === null ? '—' : formatDistance(sunDistanceM);
    },
  };
}
