// @ts-check
'use strict';

/**
 * @typedef Datapoint
 * @property {string} name
 * @property {string} description
 * @property {'number' | 'string' | 'boolean'} type
 * @property {boolean} writeable
 * @property {string} role
 * @property {string} unit
 * @property {Record<string, any>} [displayValues]
 */

const API_BASE_URI = 'https://appapi.cp.dyson.com';
const HTTP_HEADERS = {
  'User-Agent':
    'Dalvik/2.1.0 (Linux; U; Android 8.1.0; Google Build/OPM6.171019.030.E1)',
  'Content-Type': 'application/json'
};

const FILTERTYPES = {
  GCOM: 'Combined',
  PCOM: 'Combined PTFE',
  GHEP: 'HEPA',
  PHEP: 'HEPA PTFE',
  CARF: 'Activated carbon'
};
const BOOL_SWITCH = { false: 'Off', true: 'On' };
const SPECIAL_PROPERTIES = new Set(['ancp']);

const PRODUCTS = {
  358: {
    name: 'Dyson Pure Humidify+Cool',
    icon: 'icons/purifier-humidifiers.png',
    ancp: { 0: '0', 45: '45', 90: '90', BRZE: 'Breeze' }
  },
  '358E': {
    name: 'Dyson Pure Humidify+Cool',
    icon: 'icons/purifier-humidifiers.png',
    ancp: { 0: '0', 45: '45', 90: '90', BRZE: 'Breeze' }
  },
  '358K': {
    name: 'Dyson Pure Humidify+Cool Formaldehyde',
    icon: 'icons/purifier-humidifiers.png',
    ancp: { 0: '0', 45: '45', 90: '90', BRZE: 'Breeze' }
  },
  438: {
    name: 'Dyson Pure Cool Tower',
    icon: 'icons/purifiers.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  '438E': {
    name: 'Dyson Pure Cool Tower Formaldehyde',
    icon: 'icons/purifiers.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  '438K': {
    name: 'Dyson Pure Cool Tower Formaldehyde',
    icon: 'icons/purifiers.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  455: {
    name: 'Dyson Pure Hot+Cool Link',
    icon: 'icons/heaters.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  '455A': {
    name: 'Dyson Pure Hot+Cool Link',
    icon: 'icons/heaters.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  469: { name: 'Dyson Pure Cool Link Desk', icon: 'icons/fans.png', ancp: {} },
  475: {
    name: 'Dyson Pure Cool Link Tower',
    icon: 'icons/purifiers.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  520: { name: 'Dyson Pure Cool Desk', icon: 'icons/fans.png', ancp: {} },
  527: {
    name: 'Dyson Pure Hot+Cool',
    icon: 'icons/heaters.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  '527E': {
    name: 'Dyson Pure Hot+Cool',
    icon: 'icons/heaters.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  },
  '527K': {
    name: 'Dyson Pure Hot+Cool Formaldehyde',
    icon: 'icons/heaters.png',
    ancp: {
      0: '0',
      45: '45',
      90: '90',
      180: '180',
      350: '350',
      CUST: 'Custom'
    }
  }
};

const FIELDSTODELETE = ['.Sensor.PM10R', '.Sensor.PM25R'];

/**
 * @type {Map<string, Datapoint>}
 */
const datapoints = new Map([
  [
    'channel',
    {
      name: 'WIFIchannel',
      description: 'Number of the used WIFI channel.',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: ''
    }
  ],
  [
    'ercd',
    {
      name: 'LastErrorCode',
      description: 'Error code of the last error occurred on this device',
      type: 'string',
      writeable: false,
      role: 'text',
      unit: ''
    }
  ],
  [
    'wacd',
    {
      name: 'LastWarningCode',
      description: 'Warning code of the last warning occurred on this device',
      type: 'string',
      writeable: false,
      role: 'text',
      unit: ''
    }
  ],
  [
    'filf',
    {
      name: 'Filter',
      description: 'Estimated remaining filter life in hours.',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'hours'
    }
  ],
  [
    'fmod',
    {
      name: 'FanMode',
      description: 'Mode of device',
      type: 'string',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: { FAN: 'Manual', AUTO: 'Auto', OFF: 'Off' }
    }
  ],
  [
    'fnsp',
    {
      name: 'FanSpeed',
      description: 'Current fan speed',
      type: 'number',
      writeable: true,
      role: 'value',
      unit: ''
    }
  ],
  [
    'fnst',
    {
      name: 'FanStatus',
      description: 'Current Fan state; correlating to Auto-mode',
      type: 'string',
      writeable: false,
      role: 'text',
      unit: ''
    }
  ],
  [
    'nmod',
    {
      name: 'Nightmode',
      description: 'Night mode state',
      type: 'boolean',
      writeable: true,
      role: 'switch.mode.moonlight',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'qtar',
    {
      name: 'AirQualityTarget',
      description: 'Target Air quality for Auto Mode.',
      type: 'string',
      writeable: true,
      role: 'text',
      unit: '',
      displayValues: {
        '0001': '0001',
        '0002': '0002',
        '0003': '0003',
        '0004': '0004'
      }
    }
  ],
  [
    'rhtm',
    {
      name: 'ContinuousMonitoring',
      description:
        'Continuous Monitoring of environmental sensors even if device is off.',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'fpwr',
    {
      name: 'MainPower',
      description: 'Main Power of fan.',
      type: 'boolean',
      writeable: true,
      role: 'switch.power',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'auto',
    {
      name: 'AutomaticMode',
      description: 'Fan is in automatic mode.',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'nmdv',
    {
      name: 'NightModeMaxFan',
      description: 'Maximum fan speed in night mode.',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: ''
    }
  ],
  [
    'cflr',
    {
      name: 'CarbonfilterLifetime',
      description:
        'Remaining lifetime of filter installed in activated carbon filter port.',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: '%'
    }
  ],
  [
    'fdir',
    {
      name: 'Flowdirection',
      description:
        'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: { false: 'Back', true: 'Front' }
    }
  ],
  [
    'ffoc',
    {
      name: 'Flowfocus',
      description:
        'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: { false: 'Back', true: 'Front' }
    }
  ],
  [
    'hflr',
    {
      name: 'HEPA-FilterLifetime',
      description:
        'Remaining lifetime of filter installed in HEPA-Filter port.',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: '%'
    }
  ],
  [
    'cflt',
    {
      name: 'Carbonfilter',
      description: 'Filter type installed in carbon filter port.',
      type: 'string',
      writeable: false,
      role: 'text',
      unit: '',
      displayValues: FILTERTYPES
    }
  ],
  [
    'hflt',
    {
      name: 'HEPA-Filter',
      description: 'Filter type installed in HEPA-filter port.',
      type: 'string',
      writeable: false,
      role: 'text',
      unit: '',
      displayValues: FILTERTYPES
    }
  ],
  [
    'oscs',
    {
      name: 'OscillationActive',
      description: 'Fan is currently oscillating.',
      type: 'string',
      writeable: false,
      role: 'text',
      unit: '',
      displayValues: { IDLE: 'Idle', OFF: 'OFF', ON: 'ON' }
    }
  ],
  [
    'oson',
    {
      name: 'Oscillation',
      description: 'Oscillation of fan.',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'osal',
    {
      name: 'OscillationLeft',
      description: 'OscillationAngle Lower Boundary',
      type: 'number',
      writeable: true,
      role: 'text',
      unit: '°'
    }
  ],
  [
    'osau',
    {
      name: 'OscillationRight',
      description: 'OscillationAngle Upper Boundary',
      type: 'number',
      writeable: true,
      role: 'text',
      unit: '°'
    }
  ],
  [
    'ancp',
    {
      name: 'OscillationAngle',
      description: 'OscillationAngle',
      type: 'string',
      writeable: true,
      role: 'text',
      unit: '°',
      displayValues: {}
    }
  ],
  [
    'rssi',
    {
      name: 'RSSI',
      description:
        'Received Signal Strength Indication. Quality indicator for WIFI signal.',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'dBm'
    }
  ],
  [
    'pact',
    {
      name: 'Dust',
      description: 'Dust',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: ''
    }
  ],
  [
    'hact',
    {
      name: 'Humidity',
      description: 'Humidity',
      type: 'number',
      writeable: false,
      role: 'value.humidity',
      unit: '%'
    }
  ],
  [
    'sltm',
    {
      name: 'Sleeptimer',
      description: 'Sleep timer',
      type: 'number',
      writeable: true,
      role: 'value',
      unit: 'Min'
    }
  ],
  [
    'tact',
    {
      name: 'Temperature',
      description: 'Temperature',
      type: 'string',
      writeable: false,
      role: 'value.temperature',
      unit: ''
    }
  ],
  [
    'vact',
    {
      name: 'VOC',
      description: 'VOC - Volatile Organic Compounds',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: ''
    }
  ],
  [
    'pm25',
    {
      name: 'skip',
      description: 'PM2.5 - Particulate Matter 2.5µm',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'µg/m³'
    }
  ],
  [
    'pm10',
    {
      name: 'skip',
      description: 'PM10 - Particulate Matter 10µm',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'µg/m³'
    }
  ],
  [
    'va10',
    {
      name: 'VOC',
      description: 'VOC - Volatile Organic Compounds (inside)',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: ''
    }
  ],
  [
    'noxl',
    {
      name: 'NO2',
      description: 'NO2 - Nitrogen dioxide (inside)',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: ''
    }
  ],
  [
    'p25r',
    {
      name: 'PM25',
      description: 'PM2.5 - Particulate Matter 2.5µm',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'µg/m³'
    }
  ],
  [
    'p10r',
    {
      name: 'PM10',
      description: 'PM10 - Particulate Matter 10µm',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'µg/m³'
    }
  ],
  [
    'hcho',
    {
      name: 'skip',
      description: 'Current formaldehyde level',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'mg/m³'
    }
  ],
  [
    'hchr',
    {
      name: 'Formaldehyde',
      description: 'Current formaldehyde level',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'mg/m³'
    }
  ],
  [
    'hmod',
    {
      name: 'HeaterMode',
      description: 'Heating Mode [ON/OFF]',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'hmax',
    {
      name: 'TemperatureTarget',
      description: 'Target temperature for heating',
      type: 'string',
      writeable: true,
      role: 'value.temperature',
      unit: ''
    }
  ],
  [
    'hume',
    {
      name: 'HumidificationMode',
      description: 'HumidificationMode Switch [ON/OFF]',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'haut',
    {
      name: 'HumidifyAutoMode',
      description: 'Humidify AutoMode [ON/OFF]',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: BOOL_SWITCH
    }
  ],
  [
    'humt',
    {
      name: 'HumidificationTarget',
      description: 'Manual Humidification Target',
      type: 'number',
      writeable: true,
      role: 'value',
      unit: '%',
      displayValues: {
        '0030': 30,
        '0040': 40,
        '0050': 50,
        '0060': 60,
        '0070': 70
      }
    }
  ],
  [
    'cdrr',
    {
      name: 'CleanDurationRemaining',
      description: 'Time remaining in deep clean cycle',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'Min'
    }
  ],
  [
    'rect',
    {
      name: 'AutoHumidificationTarget',
      description: 'Auto Humidification target',
      type: 'number',
      writeable: true,
      role: 'value',
      unit: '%'
    }
  ],
  [
    'clcr',
    {
      name: 'DeepCleanCycle',
      description:
        'Indicates whether a deep cleaning cycle is in progress or not.',
      type: 'string',
      writeable: false,
      role: 'text',
      unit: '',
      displayValues: { CLNO: 'Inactive', CLCM: 'Completed', CLAC: 'Active' }
    }
  ],
  [
    'cltr',
    {
      name: 'TimeRemainingToNextClean',
      description: 'Time remaining to Next deep clean cycle.',
      type: 'number',
      writeable: false,
      role: 'value',
      unit: 'hours'
    }
  ],
  [
    'corf',
    {
      name: 'TemperatureUnit',
      description: 'Unit to display temperature values in (Fan display).',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: '',
      displayValues: { true: 'Celsius', false: 'Fahrenheit' }
    }
  ],
  [
    'hsta',
    {
      name: 'HeatingState',
      description: 'Active/Idle',
      type: 'string',
      writeable: false,
      role: 'value',
      unit: '',
      displayValues: { OFF: 'Idle', HEAT: 'Active' }
    }
  ],
  [
    'msta',
    {
      name: 'HumidificationState',
      description: 'Active/Idle',
      type: 'string',
      writeable: false,
      role: 'value',
      unit: '',
      displayValues: { OFF: 'Idle', HUMD: 'Active' }
    }
  ],
  [
    'wath',
    {
      name: 'WaterHardness',
      description: 'Water Hardness',
      type: 'string',
      writeable: true, // TODO: Should this be writable?
      role: 'value',
      unit: '',
      displayValues: { '0675': 'Hard', 1350: 'Medium', 2025: 'Soft' }
    }
  ],
  [
    'rstf',
    {
      name: 'ResetFilterLifetime',
      description: 'Reset filter lifetime bach to 100%',
      type: 'boolean',
      writeable: true,
      role: 'switch',
      unit: ''
    }
  ],
  [
    'amf1',
    {
      name: 'AFM_FOC_DURATION',
      description: 'AFM_FOC_DURATION',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'amf2',
    {
      name: 'AFM_OVER_VOLT',
      description: 'AFM_OVER_VOLT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'amf3',
    {
      name: 'AFM_UNDER_VOLT',
      description: 'AFM_UNDER_VOLT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'amf4',
    {
      name: 'AFM_OVER_TEMP',
      description: 'AFM_OVER_TEMP',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'amf5',
    {
      name: 'AFM_START_UP',
      description: 'AFM_START_UP',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'amf6',
    {
      name: 'AFM_SPEED_FDBK',
      description: 'AFM_SPEED_FDBK',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'amf7',
    {
      name: 'AFM_OVER_CURRENT',
      description: 'AFM_OVER_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'amf8',
    {
      name: 'AFM_SW_ERROR',
      description: 'AFM_SW_ERROR',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'bosl',
    {
      name: 'BARREL_OSCILLATION_LEFT',
      description: 'Barrel oscillation left blocked',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'bosr',
    {
      name: 'BARREL_OSCILLATION_RIGHT',
      description: 'Barrel oscillation right blocked',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'com1',
    {
      name: 'COMMS_AFM',
      description: 'COMMS_AFM',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'sen1',
    {
      name: 'DUST_SENSOR',
      description: 'Dust sensor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'sen2',
    {
      name: 'GAS_SENSOR',
      description: 'Gas sensor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'sen3',
    {
      name: 'TEMPERATURE_SENSOR',
      description: 'Temperature sensor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'sen4',
    {
      name: 'HUMIDITY_SENSOR',
      description: 'Humidity sensor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'etws',
    {
      name: 'EVAPORATION_TRAY_OVERFLOW_EXTENDED',
      description: 'EVAPORATION_TRAY_OVERFLOW_EXTENDED',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'wpmp',
    {
      name: 'WATER_PUMP_FAILURE',
      description: 'A water pump failure has been detected.',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'prot',
    {
      name: 'PUMP_ROTOR',
      description: 'Pump rotor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'uled',
    {
      name: 'UVC_LED',
      description: 'Sanitizing UV-LED failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'fltr',
    {
      name: 'FILTER_REPLACEMENT',
      description: 'At least one filter needs to be replaced.',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'tnke',
    {
      name: 'TANK_EMPTY',
      description: 'Water tank is empty.',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'tnkp',
    {
      name: 'TANK_UNDETECTED',
      description: 'Water tank could not be detected.',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'cldu',
    {
      name: 'CLEAN_CYCLE_OVERDUE',
      description: 'Clean cycle is overdue.',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'etwd',
    {
      name: 'EVAPORATION_TRAY_OVERFLOW_DETECTED',
      description: 'EVAPORATION_TRAY_OVERFLOW_DETECTED',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'cnfg',
    {
      name: 'BLDC_CONFIG_ERROR',
      description: 'BLDC_CONFIG_ERROR',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'wdog',
    {
      name: 'WATCH_DOG_RESET',
      description: 'WATCH_DOG_RESET',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ibus',
    {
      name: 'I2C_BUS',
      description: 'I2C BUS failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ilss',
    {
      name: 'ILLEGAL_SYSTEM_STATE',
      description: 'Illegal system state',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'hioc',
    {
      name: 'GEN1_HEATER_INPUT_OVER_CURRENT',
      description: 'GEN1_HEATER_INPUT_OVER_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'hilc',
    {
      name: 'GEN1_HEATER_INPUT_LOW_CURRENT',
      description: 'GEN1_HEATER_INPUT_LOW_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'htri',
    {
      name: 'GEN1_HEATER_TRIAC',
      description: 'GEN1_HEATER_TRIAC',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'hamb',
    {
      name: 'GEN1_HEATER_AMBIENT_TEMPERATURE_LOSS',
      description: 'GEN1_HEATER_AMBIENT_TEMPERATURE_LOSS',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'povi',
    {
      name: 'GEN1_HEATER_PLUG_OVER_CURRENT',
      description: 'GEN1_HEATER_PLUG_OVER_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'hctf',
    {
      name: 'GEN1_HEATER_TRIAC_COMMS',
      description: 'GEN1_HEATER_TRIAC_COMMS',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'hvmi',
    {
      name: 'GEN1_HEATER_TRIAC_VARIANT',
      description: 'GEN1_HEATER_TRIAC_VARIANT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'tilt',
    {
      name: 'GEN1_HEATER_TILT_DETECTION',
      description: 'GEN1_HEATER_TILT_DETECTION',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht01',
    {
      name: 'GEN2_HEATER_INPUT_OVER_CURRENT',
      description: 'GEN2_HEATER_INPUT_OVER_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht02',
    {
      name: 'GEN2_HEATER_INPUT_LOW_CURRENT',
      description: 'GEN2_HEATER_INPUT_LOW_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht03',
    {
      name: 'GEN2_HEATER_TRIAC',
      description: 'GEN2_HEATER_TRIAC',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht04',
    {
      name: 'GEN2_HEATER_PLUG_OVER_CURRENT',
      description: 'GEN2_HEATER_PLUG_OVER_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht05',
    {
      name: 'GEN2_HEATER_TRIAC_VARIANT_MISMATCH',
      description: 'GEN2_HEATER_TRIAC_VARIANT_MISMATCH',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht06',
    {
      name: 'GEN2_HEATER_AMBIENT_TEMPERATURE_LOSS',
      description: 'GEN2_HEATER_AMBIENT_TEMPERATURE_LOSS',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht07',
    {
      name: 'GEN2_HEATER_TILT_SENSOR',
      description: 'GEN2_HEATER_TILT_SENSOR',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht08',
    {
      name: 'GEN2_HEATER_ILLEGAL_COUNTRY',
      description: 'GEN2_HEATER_ILLEGAL_COUNTRY',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht09',
    {
      name: 'GEN2_HEATER_VARIANT_ID_ERROR',
      description: 'GEN2_HEATER_VARIANT_ID_ERROR',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ht0a',
    {
      name: 'GEN2_HEATER_CURRENT_SENSOR',
      description: 'GEN2_HEATER_CURRENT_SENSOR',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'dsts',
    {
      name: 'PARTICLE_SENSOR',
      description: 'Particle sensor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'vocs',
    {
      name: 'VOC_SENSOR',
      description: 'VOC Sensor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    't&hs',
    {
      name: 'TEMPERATURE_HUMIDITY_SENSOR',
      description: 'Temperature&Humidity sensor failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'fmco',
    {
      name: 'MOTOR_CONTROLLER',
      description: 'Motor controller failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'stto',
    {
      name: 'BLDC_STALL_TIMEOUT',
      description: 'BLDC_STALL_TIMEOUT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'hall',
    {
      name: 'BLDC_HALL_MONITOR',
      description: 'BLDC_HALL_MONITOR',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'hamp',
    {
      name: 'BLDC_OVER_CURRENT',
      description: 'BLDC_OVER_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'stal',
    {
      name: 'BLDC_STALL_CURRENT',
      description: 'BLDC_STALL_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'shrt',
    {
      name: 'BLDC_SHORT_CURRENT',
      description: 'BLDC_SHORT_CURRENT',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ],
  [
    'ste1',
    {
      name: 'PAN_OSCILLATION',
      description: 'PAN Oscillation failure',
      type: 'boolean',
      writeable: false,
      role: 'indicator',
      unit: ''
    }
  ]
]);

/**
 * returns the configDetails for any datapoint
 * @param {string} searchValue - dysonCode to search for.
 * @returns {Datapoint | undefined} returns the configDetails for any given datapoint or undefined if searchValue can't be resolved.
 */
function getDatapoint(searchValue) {
  return datapoints.get(searchValue);
}

const nameToDysoncodeTranslation = new Map(
  Array.from(datapoints.entries()).map(([key, { name }]) => [name, key])
);

/**
 * @param {string} name - name to search for.
 * @returns {string | undefined} returns the dyson code
 */
function getNameToDysoncodeTranslation(name) {
  return nameToDysoncodeTranslation.get(name);
}

module.exports = {
  API_BASE_URI,
  HTTP_HEADERS,
  PRODUCTS,
  FIELDSTODELETE,
  SPECIAL_PROPERTIES,
  getDatapoint,
  getNameToDysoncodeTranslation
};
