import {
  ERROR_TOO_MANY_TRIES,
  EXPIRED_HEADING,
  GENERIC_TRY_AGAIN,
  PHOTO_LIMIT_REACHED,
  SERVER_BAD_TYPE,
  SERVER_TOO_LARGE,
} from './copy'

/** Server result codes → Sable's wording for the customer. */
export function customerMessage(code: string | undefined): string {
  switch (code) {
    case 'rate':
      return ERROR_TOO_MANY_TRIES
    // Sable 12:49 AM (Vera QA #5): match the server rule, not the page's 10 MB / HEIC lines.
    case 'too_large':
      return SERVER_TOO_LARGE
    case 'bad_type':
    case 'unreadable':
      return SERVER_BAD_TYPE
    case 'photo_limit':
      return PHOTO_LIMIT_REACHED
    case 'expired':
      return EXPIRED_HEADING
    default:
      return GENERIC_TRY_AGAIN
  }
}
