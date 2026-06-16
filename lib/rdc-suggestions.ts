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
  POS: {
    cell: 'Desarrollo POS',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'Transacciones en POS Ingenico, Verifone, Smart Pago, POS Integrado Android',
    relatedSystems: ['Pos Ingenico', 'Pos Verifone', 'Smart Pago', 'Poslib'],
    requiresMonitoring: true,
    assisted: 'Semi asistido',
    cutImpact: 'Bajo (1 a 4 comercios)',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  Anticipo: {
    cell: 'SVA',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Servicio de Anticipo Klap, portal comercios',
    relatedSystems: ['Anticipo Klap'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'Abono Ya': {
    cell: 'SVA',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Abono Ya, liquidaciones, portal comercios',
    relatedSystems: ['Anticipo Klap', 'R2'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  Bridge: {
    cell: 'APM',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'Switch transaccional, procesamiento de tarjetas',
    relatedSystems: ['Switch TRN: Ventas con tarjetas', 'Procesamiento transaccional'],
    requiresNetworks: true,
    requiresMonitoring: true,
    assisted: 'Semi asistido',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  H2H: {
    cell: 'Adquirencia H2H',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'Switch H2H, integración con MercadoPago, Transit, Cybersource',
    relatedSystems: ['Switch TRN: Adquirencia H2H', 'SwitchEDP - Cybersource', 'H2H'],
    requiresNetworks: true,
    requiresInfra: true,
    requiresMonitoring: true,
    assisted: 'Asistido',
    schedule: 'Con restricción',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes', 'Infraestructura'],
    titlePrefix: '[Paso a PreProd y Prod]',
  },
  BO: {
    cell: 'BO y Multiservicios Central',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Multiservicio',
    environment: 'Producción',
    affectedServices: 'Backoffice, inventario, robots, reportes',
    relatedSystems: ['Backoffice: Inventario', 'Backoffice: Mantenimientos operaciones', 'Reportes BO'],
    requiresDba: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  SmartVista: {
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
    cutImpact: 'Alto (Mayor a 20 comercios)',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes', 'Infraestructura', 'Arquitectura'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  API: {
    cell: 'E-Commerce API',
    changeType: 'Software',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'APIs de integración, endpoints REST, API Tarjetas',
    relatedSystems: ['Switch TRN: API Tarjetas Grandes Clientes', 'Switch TRN: API H2H con MercadoPago'],
    requiresMonitoring: true,
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment', 'Release Management'],
    titlePrefix: '[Paso a Prod]',
  },
  Middleware: {
    cell: 'Multiservicios',
    changeType: 'Software',
    impact: 'Alto',
    priority: 'Alta',
    impactedBusiness: 'PCI',
    environment: 'Producción',
    affectedServices: 'Middleware de integración, servicios core',
    relatedSystems: ['ISWITCH', 'Core Switch Transaccional Multiservicios', 'Replicación de Datos'],
    requiresNetworks: true,
    requiresInfra: true,
    requiresMonitoring: true,
    assisted: 'Semi asistido',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Infraestructura'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  Portal: {
    cell: 'Web Privada',
    changeType: 'Software',
    impact: 'Bajo',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    affectedServices: 'Portal público, portal comercios, intranet',
    relatedSystems: ['Portal Público Klap', 'Intranet Klap', 'Portal Privado Comercios'],
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'Deployment'],
    titlePrefix: '[Paso Prod][MANT]',
  },
  'App Klap': {
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
  'Data Analytics': {
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
 * Formato: [Paso Prod][TIPO] Descripción del cambio / JIRA-XXX
 */
export function suggestTitle(system: string, category: string): string {
  const catTag = category === 'Mantención' ? 'MANT' :
    category === 'Proyecto' ? 'PROY' :
    category === 'Incidente' ? 'INC' :
    category === 'Hotfix' ? 'HOTFIX' :
    category === 'Recurrente' ? 'MANT' : 'MANT';

  return `[Paso Prod][${catTag}] `;
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
