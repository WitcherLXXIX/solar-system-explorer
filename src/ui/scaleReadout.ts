import { formatDistance, formatLightTime, niceLength } from '../format/format';
import type { CameraPose } from '../camera/cameraController';
import { getBody } from '../catalog/bodies';
import { el } from './dom';

const TARGET_BAR_PX = 120;

export function createScaleReadout(root: HTMLElement): {
  update(args: { pose: CameraPose; fovYRad: number; viewportHeightPx: number; sunDistanceM: number }): void;
} {
  const title = el('div', 'readout-title');
  const altitude = el('div', 'readout-line');
  const light = el('div', 'readout-line dim');
  const sun = el('div', 'readout-line dim');
  const bar = el('div', 'scalebar');
  const barLabel = el('div', 'scalebar-label');
  root.append(title, altitude, light, sun, bar, barLabel);

  return {
    update({ pose, fovYRad, viewportHeightPx, sunDistanceM }) {
      title.textContent = getBody(pose.focusId).name;
      altitude.textContent = `Altitude ${formatDistance(pose.altitudeM)}`;
      light.textContent = `Light travel ${formatLightTime(pose.altitudeM)}`;
      sun.textContent = `Distance from Sun ${formatDistance(sunDistanceM)}`;
      const metresPerPx = (2 * Math.tan(fovYRad / 2) * pose.distanceM) / viewportHeightPx;
      const barM = niceLength(metresPerPx * TARGET_BAR_PX);
      bar.style.width = `${barM / metresPerPx}px`;
      barLabel.textContent = formatDistance(barM);
    },
  };
}
