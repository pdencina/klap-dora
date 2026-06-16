/**
 * Motor de sugerencias inteligentes para el formulario RDC.
 *
 * Basado en patrones frecuentes de cambios históricos de KLAP,
 * sugiere valores para los campos del formulario según el sistema/producto seleccionado.
 *
 * Las sugerencias se pueden extender fácilmente con datos reales de la BD.
 */

export type RdcSuggestion = {
  cell?: string;
  category?: string;
  changeType?: string;
  impact?: string;
  priority?: string;
  urgency?: string;
  impactedBusiness?: string;
  environment?: string;
  affectedServices?: string;
  relatedSystems?: string[];
  requiresDba?: boolean;
  requiresNetworks?: boolean;
  requiresInfra?: boolean;
  requiresMonitoring?: boolean;
  assisted?: string;
  schedule?: string;
  cutImpact?: string;
  selectedApprovalRoles?: string[];
  titlePrefix?: string;
};

/**
 * Mapeo Sistema/Producto → Sugerencias de campos.
 * Basado en patrones frecuentes de RDC históricos.
 */
const SYSTEM_SUGGESTIONS: Record<string, RdcSuggestion> = {
  'POS Tradicional Ingenico': {
    cell: 'Desarrollo POS',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'POS Tradicional Ingenico, transacciones presenciales con tarjetas',
    relatedSystems: ['Pos Ingenico'],
    requiresMonitoring: true,
    assisted: 'Semi asistido',
    cutImpact: 'Bajo (1 a 4 comercios)',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'POS Tradicional Verifone': {
    cell: 'Desarrollo POS',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'POS Tradicional Verifone, transacciones presenciales con tarjetas',
    relatedSystems: ['Pos Verifone'],
    requiresMonitoring: true,
    assisted: 'Semi asistido',
    cutImpact: 'Bajo (1 a 4 comercios)',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'SmartPago': {
    cell: 'Desarrollo POS',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'SmartPago, POS Android, transacciones presenciales',
    relatedSystems: ['Smart Pago', 'Poslib'],
    requiresMonitoring: true,
    assisted: 'Semi asistido',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'POS Integrado Android': {
    cell: 'Canales Presenciales',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'POS Integrado Android, aplicaciones embebidas',
    relatedSystems: ['Pos Integrado Android'],
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'App Klap (TTP)': {
    cell: 'App Klap',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'App Klap, Tap To Phone, experiencia de usuario móvil',
    relatedSystems: ['App Klap + Tap To Phone'],
    requiresMonitoring: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'API Tarjetas (E-Commerce)': {
    cell: 'E-Commerce API',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'API Tarjetas, E-Commerce Gateway, procesamiento de pagos online',
    relatedSystems: ['Switch TRN: API Tarjetas Grandes Clientes'],
    requiresMonitoring: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso a Prod]',
  },
  'API H2H': {
    cell: 'Adquirencia H2H',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'Switch H2H, integración con MercadoPago, Cybersource',
    relatedSystems: ['Switch TRN: Adquirencia H2H', 'SwitchEDP - Cybersource'],
    requiresNetworks: true,
    requiresInfra: true,
    requiresMonitoring: true,
    assisted: 'Asistido',
    schedule: 'Con restricción',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes', 'Infraestructura'],
    titlePrefix: '[Paso a PreProd y Prod]',
  },
  'API Transit': {
    cell: 'E-Commerce API',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'API Transit, modelo Retail-like y Agregador',
    relatedSystems: ['Switch TRN: API Transit'],
    requiresMonitoring: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso a PreProd y Prod]',
  },
  'Checkout / Link de Pago': {
    cell: 'E-Commerce Checkout',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Klap Checkout, Checkout Transparente, Link de Pago, Oneclick',
    relatedSystems: ['Klap Checkout (Pasarela)', 'Checkout Transparente', 'Link de Pago'],
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Boleta Electrónica': {
    cell: 'Boleta Electrónica y Multiservicios',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'Boleta electrónica, recepción BE POS, envío SII, robots',
    relatedSystems: ['Recepción de BE POS', 'Envío BE SII', 'Robot Descarga CAF'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: 'Paso a Prod: MANT /',
  },
  'SmartVista': {
    cell: 'SmartVista',
    changeType: 'Software',
    impact: 'Crítico',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'SVXP Generator, Consumers marcas, gestor de cuotas, contabilidad',
    relatedSystems: ['SVXP Generator', 'Consumers (Amex, Visa, Mastercard, UPI)', 'Gestor de cuotas', 'Contabilidad'],
    requiresDba: true,
    requiresNetworks: true,
    requiresInfra: true,
    requiresMonitoring: true,
    assisted: 'Asistido',
    schedule: 'Con restricción',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Infraestructura', 'Arquitectura'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Web Privada (Portal Comercios)': {
    cell: 'Web Privada',
    changeType: 'Software',
    impact: 'Bajo',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Portal Privado Comercios, web comercio',
    relatedSystems: ['Portal Privado Comercios'],
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Web Pública (klap.cl)': {
    cell: 'Clientes',
    changeType: 'Software',
    impact: 'Bajo',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Portal público Klap, web pública, autoafiliación',
    relatedSystems: ['Portal Público Klap'],
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Backoffice': {
    cell: 'BO y Multiservicios Central',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'Backoffice, inventario, robots, mantenedores, reportes',
    relatedSystems: ['Backoffice: Inventario', 'Backoffice: Mantenimientos operaciones', 'Reportes BO'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Multiservicios (PDC/Recargas/JDA)': {
    cell: 'Multiservicios',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'Pago de cuentas, recargas telefónicas, juegos de azar, sencillito',
    relatedSystems: ['Recargas Telefónicas', 'Pago de Cuentas Web'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: 'Paso a Prod: MANT /',
  },
  'Alimentación (Pluxee/Edenred/Amipass)': {
    cell: 'APM',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Transacciones tarjetas de alimentación, Sodexo/Pluxee, Edenred, Amipass',
    relatedSystems: ['Transacciones Tarjetas de Alimentación: Sodexo - Edenred - Amipass'],
    requiresMonitoring: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Clearing (Visa/Mastercard/Amex)': {
    cell: 'Adquirencia Clearing',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'Clearing, settlement, preliquidación, CNL, contracargos',
    relatedSystems: ['Switch BAT: Clearing/Settlement', 'CNL', 'Contracargos y Disputas'],
    requiresDba: true,
    requiresMonitoring: true,
    assisted: 'Semi asistido',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso a Pre y Prod]',
  },
  'Anticipo Klap / Abono Ya': {
    cell: 'SVA',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'Anticipo Klap, Abono Ya, transferencias, cálculos',
    relatedSystems: ['Anticipo Klap'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'R2 Crédito Emprende': {
    cell: 'SVA',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'R2 Crédito Emprende, retenciones, reportes',
    relatedSystems: ['R2'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Cuota Comercio': {
    cell: 'SVA',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicios',
    environment: 'Producción',
    affectedServices: 'Cuota Comercio, gestor de cuotas, reporte web',
    relatedSystems: ['Cuota Comercio'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Data Analytics (Redshift/S3)': {
    cell: 'SmartVista',
    changeType: 'Base de Datos',
    impact: 'Bajo',
    priority: 'Baja',
    impactedBusiness: 'No aplica',
    environment: 'Producción',
    affectedServices: 'Data warehouse (Redshift), Data lake (S3), reportes analíticos',
    relatedSystems: ['Data warehouse (Redshift)', 'Data lake (S3)', 'Data Gobernance (Lakeformation)'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Redes': {
    cell: 'Redes',
    changeType: 'Redes',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'No aplica',
    environment: 'Producción',
    affectedServices: 'Switches, firewalls, VPN, MPLS, comunicaciones',
    relatedSystems: [],
    requiresNetworks: true,
    selectedApprovalRoles: ['Dueño Cambio', 'Deployment', 'Redes'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Infraestructura / Ingeniería': {
    cell: 'Ingeniería de Sistemas',
    changeType: 'Infraestructura',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'No aplica',
    environment: 'Producción',
    affectedServices: 'Servidores, Kubernetes, VMware, storage, backups',
    relatedSystems: [],
    requiresInfra: true,
    selectedApprovalRoles: ['Dueño Cambio', 'Deployment', 'Infraestructura'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Afiliación y Contrato': {
    cell: 'Afiliación y Contrato',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Autoafiliación, contrato digital, volcado comercios, BFF',
    relatedSystems: ['Registro Comercio'],
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'IMED': {
    cell: 'APM',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'IMED, bonos electrónicos, integración salud',
    relatedSystems: ['IMED'],
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
};

/**
 * Mapeo Categoría → ajustes adicionales de sugerencia.
 */
const CATEGORY_ADJUSTMENTS: Record<string, Partial<RdcSuggestion>> = {
  Hotfix: {
    urgency: 'Hotfix',
    priority: 'Urgente',
    schedule: 'Con restricción',
    assisted: 'Semi asistido',
  },
  Incidente: {
    urgency: 'Emergencia',
    priority: 'Urgente',
    impact: 'Alto',
  },
  Recurrente: {
    urgency: 'Recurrente',
    priority: 'Media',
    impact: 'Bajo',
  },
  Proyecto: {
    urgency: 'Normal',
  },
  Mantención: {
    urgency: 'Normal',
  },
};

/**
 * Obtiene sugerencias para el formulario basado en el sistema seleccionado.
 */
export function getSuggestionsForSystem(system: string): RdcSuggestion | null {
  return SYSTEM_SUGGESTIONS[system] || null;
}

/**
 * Obtiene ajustes basados en la categoría seleccionada.
 */
export function getAdjustmentsForCategory(category: string): Partial<RdcSuggestion> | null {
  return CATEGORY_ADJUSTMENTS[category] || null;
}

/**
 * Combina sugerencias de sistema + categoría para una sugerencia unificada.
 */
export function getCombinedSuggestions(system: string, category: string): RdcSuggestion | null {
  const base = getSuggestionsForSystem(system);
  const catAdj = getAdjustmentsForCategory(category);

  if (!base && !catAdj) return null;

  return {
    ...(base || {}),
    ...(catAdj || {}),
  };
}

/**
 * Genera un título sugerido basado en sistema y categoría.
 * Formatos reales extraídos de la planilla de cambios históricos:
 * - [Paso Prod][MANT] ...
 * - [Paso a Prod] MANT/...
 * - [Paso a PreProd y Prod] MANT/...
 * - [Paso Prod][PROY] ...
 * - [Paso Prod][INC] ...
 * - Paso a Prod: Hotfix / ...
 */
export function suggestTitle(system: string, category: string): string {
  switch (category) {
    case 'Mantención':
      return '[Paso Prod][MANT] ';
    case 'Proyecto':
      return '[Paso Prod][PROY] ';
    case 'Incidente':
      return '[Paso Prod][INC] ';
    case 'Hotfix':
      return 'Paso a Prod: Hotfix / ';
    case 'Recurrente':
      return '[Paso a Prod] MANT/';
    default:
      return '[Paso Prod][MANT] ';
  }
}

/**
 * Lista de campos que tienen sugerencia disponible dado un sistema.
 */
export function getAvailableSuggestionFields(system: string): string[] {
  const suggestion = getSuggestionsForSystem(system);
  if (!suggestion) return [];

  const fields: string[] = [];
  if (suggestion.cell) fields.push('cell');
  if (suggestion.changeType) fields.push('changeType');
  if (suggestion.impact) fields.push('impact');
  if (suggestion.priority) fields.push('priority');
  if (suggestion.urgency) fields.push('urgency');
  if (suggestion.impactedBusiness) fields.push('impactedBusiness');
  if (suggestion.environment) fields.push('environment');
  if (suggestion.affectedServices) fields.push('affectedServices');
  if (suggestion.relatedSystems?.length) fields.push('relatedSystems');
  if (suggestion.requiresDba !== undefined) fields.push('requiresDba');
  if (suggestion.requiresNetworks !== undefined) fields.push('requiresNetworks');
  if (suggestion.requiresInfra !== undefined) fields.push('requiresInfra');
  if (suggestion.requiresMonitoring !== undefined) fields.push('requiresMonitoring');
  if (suggestion.assisted) fields.push('assisted');
  if (suggestion.schedule) fields.push('schedule');
  if (suggestion.cutImpact) fields.push('cutImpact');
  if (suggestion.selectedApprovalRoles?.length) fields.push('selectedApprovalRoles');
  return fields;
}
