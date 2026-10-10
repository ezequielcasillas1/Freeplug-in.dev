/**
 * Dashboard language switch placement (Lina, Oct 10): a plain text link in the header, just left of
 * the account controls. At 375px it still fits on one line beside "Sign out", so it stays in the
 * header. If it ever stops fitting, set this to 'menu' to make it the first item of the account menu.
 */
export type PickerPlacement = 'header' | 'menu'
export const DASHBOARD_PICKER_PLACEMENT: PickerPlacement = 'header'
