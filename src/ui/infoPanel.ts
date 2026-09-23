import { getBody, type BodyId } from '../catalog/bodies';
import { orbitalPeriodDays } from '../ephemeris/ephemeris';
import {
  formatDistance, formatMass, formatPeriodDays, formatRadius, formatTemp,
} from '../format/format';
import { dayLengthText, formatGravity, kindLabel, mapNote } from './bodyText';
import { el } from './dom';

export function createInfoPanel(root: HTMLElement): { setBody(id: BodyId): void; update(sunDistanceM: number | null): void } {
  const heading = el('h2');
  const kind = el('p', 'dim');
  const list = el('dl', 'facts');
  const foot = el('p', 'dim small');
  const mapFoot = el('p', 'dim small');
  root.append(heading, kind, list, foot, mapFoot);
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
      const parentName = body.parent !== null && body.parent !== 'sun' ? getBody(body.parent).name : null;
      const periodNote =
        body.kind === 'moon' ? `Sidereal period around ${parentName ?? 'its parent'}`
        : body.kind === 'dwarf' ? 'Sidereal period around the Sun'
        : 'From astronomy-engine (VSOP87)';
      heading.textContent = body.name;
      kind.textContent = kindLabel(body.kind, parentName);
      list.replaceChildren();
      addRow('Radius', formatRadius(body.radiusM), 'Volumetric mean radius');
      addRow('Mass', body.massKg === null ? '—' : formatMass(body.massKg));
      addRow('Orbital period', period === null ? 'n/a' : formatPeriodDays(period), periodNote);
      addRow('Day length', dayLengthText(body.rotationPeriodH), 'Sidereal rotation period');
      addRow('Axial tilt', body.axialTiltDeg === null ? '—' : `${body.axialTiltDeg}°`);
      addRow('Surface gravity', body.surfaceGravity === null ? '—' : formatGravity(body.surfaceGravity));
      addRow('Mean temperature', body.meanTempK === null ? '—' : formatTemp(body.meanTempK), body.tempNote);
      sunDistanceValue = addRow('Distance from Sun', '');
      foot.textContent = `Source: ${body.source}`;
      mapFoot.textContent = mapNote(body.maps.color !== undefined, body.mapCredit);
    },
    update(sunDistanceM) {
      if (sunDistanceValue) sunDistanceValue.textContent = sunDistanceM === null ? '—' : formatDistance(sunDistanceM);
    },
  };
}
