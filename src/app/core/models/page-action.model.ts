export interface PageAction {
  id: string;
  label: string;
  shortLabel?: string;
  icon: string;
  primary?: boolean;
  danger?: boolean;
  success?: boolean;
  labeled?: boolean;
  iconOnly?: boolean;
  iconOnlyMobile?: boolean;
  routerLink?: string | readonly unknown[];
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  href?: string;
  click?: () => void;
}
