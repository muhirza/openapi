'use client';

import { SVGProps } from 'react';

/** Common props for all icon components */
interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/** Create a consistent icon component */
function createIcon(paths: string[], viewBox = '0 0 24 24') {
  return function Icon({ size = 20, className = '', ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
    );
  };
}

// Layout / Navigation
export const IconDashboard = createIcon([
  'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  'M9 22V12h6v10',
]);
export const IconSmartphone = createIcon([
  'M5 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5z',
  'M12 18h.01',
]);
export const IconPackage = createIcon([
  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  'M3.27 6.96L12 12.01l8.73-5.05',
  'M12 22.08V12',
]);
export const IconZap = createIcon([
  'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
]);
export const IconDownload = createIcon([
  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
  'M7 10l5 5 5-5',
  'M12 15V3',
]);
export const IconBoxes = createIcon([
  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  'M3.27 6.96L12 12.01l8.73-5.05',
  'M12 22.08V12',
]);
export const IconHistory = createIcon([
  'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
]);
export const IconSettings = createIcon([
  'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
  'M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
]);

// Actions
export const IconMenu = createIcon([
  'M3 12h18',
  'M3 6h18',
  'M3 18h18',
]);

// Digital stock
export const IconLayers = createIcon([
  'M12 2L2 7l10 5 10-5-10-5z',
  'M2 17l10 5 10-5',
  'M2 12l10 5 10-5',
]);
export const IconUpload = createIcon([
  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
  'M17 8l-5-5-5 5',
  'M12 3v12',
]);
export const IconSearch = createIcon([
  'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  'M21 21l-4.35-4.35',
]);

export const IconX = createIcon([
  'M18 6L6 18',
  'M6 6l12 12',
]);
export const IconRefresh = createIcon([
  'M23 4v6h-6',
  'M1 20v-6h6',
  'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
]);
export const IconLogout = createIcon([
  'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
  'M16 17l5-5-5-5',
  'M21 12H9',
]);

// Balance / Wallet
export const IconWallet = createIcon([
  'M21 12V7H5a2 2 0 0 1 0-4h14v4',
  'M3 5v14a2 2 0 0 0 2 2h16v-5',
]);
export const IconCoins = createIcon([
  'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z',
  'M12 6v8',
  'M6 12h12',
]);
export const IconLightning = createIcon([
  'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
]);

// Status
export const IconCheckCircle = createIcon([
  'M22 11.08V12a10 10 0 1 1-5.93-9.14',
  'M22 4L12 14.01l-3-3',
]);
export const IconAlertCircle = createIcon([
  'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z',
  'M12 8v4',
  'M12 16h.01',
]);
export const IconAlertTriangle = createIcon([
  'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  'M12 9v4',
  'M12 17h.01',
]);
export const IconClock = createIcon([
  'M12 6v6l4 2',
  'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z',
]);

// User / Avatar
export const IconUser = createIcon([
  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
  'M12 9a4 4 0 0 1 0 8',
]);
export const IconChevronRight = createIcon([
  'M9 18l6-6-6-6',
]);
export const IconChevronDown = createIcon([
  'M6 9l6 6 6-6',
]);
export const IconCheck = createIcon([
  'M20 6L9 17l-5-5',
]);

// Security / credentials
export const IconKey = createIcon([
  'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777z',
  'M15.5 7.5l3 3L22 7l-3-3',
]);
export const IconLock = createIcon([
  'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
  'M8 11V7a4 4 0 0 1 8 0v4',
  'M12 15v3',
]);
export const IconShieldCheck = createIcon([
  'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'M9 12l2 2 4-4',
]);
export const IconEye = createIcon([
  'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z',
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
]);
export const IconEyeOff = createIcon([
  'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94',
  'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19',
  'M14.12 14.12a3 3 0 1 1-4.24-4.24',
  'M1 1l22 22',
]);