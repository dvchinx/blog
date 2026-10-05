// Política de tratamiento de datos personales (Ley 1581 de 2012 y Decreto 1377
// de 2013). Texto plano compartido por la página /privacidad y el prerender.
// Si cambia el contenido, actualizar también `policyVersion` en
// newsletter/src/config.js: cada suscriptor guarda la versión que aceptó.

export const PRIVACY_CONTACT_EMAIL = 'newsletter@jesusflorez.cloud'
export const PRIVACY_UPDATED_AT = '5 de octubre de 2026'

export const PRIVACY_SECTIONS = [
  {
    title: 'Responsable del tratamiento',
    paragraphs: [
      `Jesús Flórez, autor de blog.jesusflorez.cloud, es el responsable de los datos personales recogidos a través del formulario del newsletter. Puedes escribir a ${PRIVACY_CONTACT_EMAIL} para cualquier consulta o reclamo sobre tus datos.`
    ]
  },
  {
    title: 'Qué datos recogemos',
    paragraphs: [
      'Solo tu dirección de correo electrónico, las categorías que elegiste (Tecnología, Programación Competitiva o ambas) y la fecha en que aceptaste esta política y confirmaste tu suscripción. No pedimos tu nombre ni ningún otro dato, y no usamos píxeles de seguimiento en los correos.'
    ]
  },
  {
    title: 'Para qué los usamos',
    paragraphs: [
      'Únicamente para enviarte el resumen semanal con los artículos nuevos de las categorías que elegiste, y los correos necesarios para gestionar tu suscripción (confirmación y avisos sobre la misma). No vendemos, alquilamos ni compartimos tus datos con terceros para publicidad.'
    ]
  },
  {
    title: 'Quién más accede a ellos',
    paragraphs: [
      'Los correos se envían a través de Resend (Resend, Inc., Estados Unidos), que actúa como encargado del tratamiento y procesa tu dirección solo para entregar los mensajes. Al suscribirte autorizas esta transferencia internacional de datos con esa única finalidad.'
    ]
  },
  {
    title: 'Cuánto tiempo los conservamos',
    paragraphs: [
      'Mientras mantengas tu suscripción. Si te das de baja, tu correo se borra de inmediato. Si no confirmas la suscripción, tus datos se eliminan automáticamente a los 7 días.'
    ]
  },
  {
    title: 'Tus derechos',
    paragraphs: [
      'Como titular de los datos puedes conocer, actualizar y rectificar tu información, solicitar prueba de la autorización que otorgaste, revocarla, pedir que se supriman tus datos y presentar quejas ante la Superintendencia de Industria y Comercio (SIC).',
      `Al pie de cada correo encontrarás un enlace para cambiar tus categorías o darte de baja, lo que borra tus datos al instante. Para cualquier otra solicitud escribe a ${PRIVACY_CONTACT_EMAIL}; respondemos consultas en un máximo de 10 días hábiles y reclamos en un máximo de 15 días hábiles, como establece la ley.`
    ]
  },
  {
    title: 'Seguridad',
    paragraphs: [
      'Los datos se guardan en un servidor propio, sin acceso público, y todas las comunicaciones con el blog viajan cifradas mediante HTTPS.'
    ]
  },
  {
    title: 'Vigencia',
    paragraphs: [
      `Esta política rige desde el ${PRIVACY_UPDATED_AT}. Si cambia de forma relevante, te avisaremos por correo antes de aplicar los cambios.`
    ]
  }
]
