export const APPCENTER_URL = 'https://appcenter.xul.es'

/**
 * Redirige a AppCenter para autenticarse, indicando a qué URL volver
 * una vez el usuario haya iniciado sesión (flujo de "sesión ausente").
 */
export function redirectToAppCenterLogin() {
  const returnTo = encodeURIComponent(window.location.href.split('?')[0])
  window.location.href = `${APPCENTER_URL}?return_to=${returnTo}`
}

/**
 * Cierre de sesión explícito: lleva a la vista principal de todas las apps
 * de AppCenter, SIN return_to (no debe rebotar de vuelta a MyTicket).
 */
export function redirectToAppCenterHome() {
  // Marca para que AuthProvider no dispare el flujo de login con return_to
  sessionStorage.setItem('myticket_signing_out', '1')
  window.location.href = APPCENTER_URL
}
