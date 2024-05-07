'use strict';

const dysonConstant = require('./dysonConstants');

module.exports.API_BASE_URI = 'https://appapi.cp.dyson.com';
module.exports.HTTP_HEADERS = {
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

module.exports.LOAD_FROM_PRODUCTS = 999;
module.exports.PRODUCTS = {
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

module.exports.FIELDSTODELETE = ['.Sensor.PM10R', '.Sensor.PM25R'];

// data structure to determine readable names, etc for any datapoint
// Every row is one state in a dyson message. Format: [ 0-dysonCode, 1-Name of Datapoint, 2-Description, 3-datatype, 4-writeable, 5-role, 6-unit, 7-possible values for data field]
module.exports.DATAPOINTS = [
  [
    'channel',
    'WIFIchannel',
    'Number of the used WIFI channel.',
    'number',
    'false',
    'value',
    ''
  ],
  [
    'ercd',
    'LastErrorCode',
    'Error code of the last error occurred on this device',
    'string',
    'false',
    'text',
    ''
  ],
  [
    'wacd',
    'LastWarningCode',
    'Warning code of the last warning occurred on this device',
    'string',
    'false',
    'text',
    ''
  ],
  [
    'filf',
    'FilterLife',
    'Estimated remaining filter life in hours.',
    'number',
    'false',
    'value',
    'hours'
  ],
  [
    'fmod',
    'FanMode',
    'Mode of device',
    'string',
    'true',
    'switch',
    '',
    { FAN: 'Manual', AUTO: 'Auto', OFF: 'Off' }
  ],
  ['fnsp', 'FanSpeed', 'Current fan speed', 'number', 'true', 'value', ''],
  [
    'fnst',
    'FanStatus',
    'Current Fan state; correlating to Auto-mode',
    'string',
    'false',
    'text',
    ''
  ],
  [
    'nmod',
    'Nightmode',
    'Night mode state',
    'boolean',
    'true',
    'switch.mode.moonlight',
    '',
    BOOL_SWITCH
  ],
  [
    'qtar',
    'AirQualityTarget',
    'Target Air quality for Auto Mode.',
    'string',
    'true',
    'text',
    '',
    { '0001': '0001', '0002': '0002', '0003': '0003', '0004': '0004' }
  ],
  [
    'rhtm',
    'ContinuousMonitoring',
    'Continuous Monitoring of environmental sensors even if device is off.',
    'boolean',
    'true',
    'switch',
    '',
    BOOL_SWITCH
  ],
  [
    'fpwr',
    'MainPower',
    'Main Power of fan.',
    'boolean',
    'true',
    'switch.power',
    '',
    BOOL_SWITCH
  ],
  [
    'auto',
    'AutomaticMode',
    'Fan is in automatic mode.',
    'boolean',
    'true',
    'switch',
    '',
    BOOL_SWITCH
  ],
  [
    'nmdv',
    'NightModeMaxFan',
    'Maximum fan speed in night mode.',
    'number',
    'false',
    'value',
    ''
  ],
  [
    'cflr',
    'CarbonfilterLifetime',
    'Remaining lifetime of filter installed in activated carbon filter port.',
    'number',
    'false',
    'value',
    '%'
  ],
  [
    'fdir',
    'Flowdirection',
    'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)',
    'boolean',
    'true',
    'switch',
    '',
    { false: 'Back', true: 'Front' }
  ],
  [
    'ffoc',
    'Flowfocus',
    'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)',
    'boolean',
    'true',
    'switch',
    '',
    { false: 'Back', true: 'Front' }
  ],
  [
    'hflr',
    'HEPA-FilterLifetime',
    'Remaining lifetime of filter installed in HEPA-Filter port.',
    'number',
    'false',
    'value',
    '%'
  ],
  [
    'cflt',
    'Carbonfilter',
    'Filter type installed in carbon filter port.',
    'string',
    'false',
    'text',
    '',
    FILTERTYPES
  ],
  [
    'hflt',
    'HEPA-Filter',
    'Filter type installed in HEPA-filter port.',
    'string',
    'false',
    'text',
    '',
    FILTERTYPES
  ],
  ['sltm', 'Sleeptimer', 'Sleep timer.', 'string', 'false', 'text', ''],
  [
    'oscs',
    'OscillationActive',
    'Fan is currently oscillating.',
    'string',
    'false',
    'text',
    '',
    { IDLE: 'Idle', OFF: 'OFF', ON: 'ON' }
  ],
  [
    'oson',
    'Oscillation',
    'Oscillation of fan.',
    'boolean',
    'true',
    'switch',
    '',
    BOOL_SWITCH
  ],
  [
    'osal',
    'OscillationLeft',
    'OscillationAngle Lower Boundary',
    'number',
    'true',
    'text',
    '°'
  ],
  [
    'osau',
    'OscillationRight',
    'OscillationAngle Upper Boundary',
    'number',
    'true',
    'text',
    '°'
  ],
  [
    'ancp',
    'OscillationAngle',
    'OscillationAngle',
    'string',
    'true',
    'text',
    '°',
    dysonConstant.LOAD_FROM_PRODUCTS
  ],
  [
    'rssi',
    'RSSI',
    'Received Signal Strength Indication. Quality indicator for WIFI signal.',
    'number',
    'false',
    'value',
    'dBm'
  ],
  ['pact', 'Dust', 'Dust', 'number', 'false', 'value', ''],
  ['hact', 'Humidity', 'Humidity', 'number', 'false', 'value.humidity', '%'],
  ['sltm', 'Sleeptimer', 'Sleep timer', 'number', 'false', 'value', 'Min'],
  [
    'tact',
    'Temperature',
    'Temperature',
    'string',
    'false',
    'value.temperature',
    ''
  ],
  [
    'vact',
    'VOC',
    'VOC - Volatile Organic Compounds',
    'number',
    'false',
    'value',
    ''
  ],
  [
    'pm25',
    'skip',
    'PM2.5 - Particulate Matter 2.5µm',
    'number',
    'false',
    'value',
    'µg/m³'
  ],
  [
    'pm10',
    'skip',
    'PM10 - Particulate Matter 10µm',
    'number',
    'false',
    'value',
    'µg/m³'
  ],
  [
    'va10',
    'VOC',
    'VOC - Volatile Organic Compounds (inside)',
    'number',
    'false',
    'value',
    ''
  ],
  [
    'noxl',
    'NO2',
    'NO2 - Nitrogen dioxide (inside)',
    'number',
    'false',
    'value',
    ''
  ],
  [
    'p25r',
    'PM25',
    'PM2.5 - Particulate Matter 2.5µm',
    'number',
    'false',
    'value',
    'µg/m³'
  ],
  [
    'p10r',
    'PM10',
    'PM10 - Particulate Matter 10µm',
    'number',
    'false',
    'value',
    'µg/m³'
  ],
  [
    'hcho',
    'skip',
    'Current formaldehyde level',
    'number',
    'false',
    'value',
    'mg/m³'
  ],
  [
    'hchr',
    'Formaldehyde',
    'Current formaldehyde level',
    'number',
    'false',
    'value',
    'mg/m³'
  ],
  [
    'hmod',
    'HeaterMode',
    'Heating Mode [ON/OFF]',
    'boolean',
    'true',
    'switch',
    '',
    BOOL_SWITCH
  ],
  [
    'hmax',
    'TemperatureTarget',
    'Target temperature for heating',
    'string',
    'true',
    'value.temperature',
    ''
  ],
  [
    'hume',
    'HumidificationMode',
    'HumidificationMode Switch [ON/OFF]',
    'boolean',
    'true',
    'switch',
    '',
    BOOL_SWITCH
  ],
  [
    'haut',
    'HumidifyAutoMode',
    'Humidify AutoMode [ON/OFF]',
    'boolean',
    'true',
    'switch',
    '',
    BOOL_SWITCH
  ],
  [
    'humt',
    'HumidificationTarget',
    'Manual Humidification Target',
    'number',
    'true',
    'value',
    '%',
    { '0030': 30, '0040': 40, '0050': 50, '0060': 60, '0070': 70 }
  ],
  [
    'cdrr',
    'CleanDurationRemaining',
    'Time remaining in deep clean cycle',
    'number',
    'false',
    'value',
    'Min'
  ],
  [
    'rect',
    'AutoHumidificationTarget',
    'Auto Humidification target',
    'number',
    'true',
    'value',
    '%'
  ],
  [
    'clcr',
    'DeepCleanCycle',
    'Indicates whether a deep cleaning cycle is in progress or not.',
    'string',
    'false',
    'text',
    '',
    { CLNO: 'Inactive', CLCM: 'Completed', CLAC: 'Active' }
  ],
  [
    'cltr',
    'TimeRemainingToNextClean',
    'Time remaining to Next deep clean cycle.',
    'number',
    'false',
    'value',
    'hours'
  ],
  [
    'corf',
    'TemperatureUnit',
    'Unit to display temperature values in (Fan display).',
    'boolean',
    'true',
    'switch',
    '',
    { true: 'Celsius', false: 'Fahrenheit' }
  ],
  [
    'hsta',
    'HeatingState',
    'Active/Idle',
    'string',
    'false',
    'value',
    '',
    { OFF: 'Idle', HEAT: 'Active' }
  ],
  [
    'msta',
    'HumidificationState',
    'Active/Idle',
    'string',
    'false',
    'value',
    '',
    { OFF: 'Idle', HUMD: 'Active' }
  ],
  [
    'wath',
    'WaterHardness',
    'Water Hardness',
    'string',
    'true',
    'value',
    '',
    { '0675': 'Hard', 1350: 'Medium', 2025: 'Soft' }
  ],
  [
    'rstf',
    'ResetFilterLifetime',
    'Reset filter lifetime bach to 100%',
    'boolean',
    'true',
    'switch',
    ''
  ],
  [
    'amf1',
    'AFM_FOC_DURATION',
    'AFM_FOC_DURATION',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'amf2',
    'AFM_OVER_VOLT',
    'AFM_OVER_VOLT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'amf3',
    'AFM_UNDER_VOLT',
    'AFM_UNDER_VOLT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'amf4',
    'AFM_OVER_TEMP',
    'AFM_OVER_TEMP',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  ['amf5', 'AFM_START_UP', 'AFM_START_UP', 'boolean', 'false', 'indicator', ''],
  [
    'amf6',
    'AFM_SPEED_FDBK',
    'AFM_SPEED_FDBK',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'amf7',
    'AFM_OVER_CURRENT',
    'AFM_OVER_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  ['amf8', 'AFM_SW_ERROR', 'AFM_SW_ERROR', 'boolean', 'false', 'indicator', ''],
  [
    'bosl',
    'BARREL_OSCILLATION_LEFT',
    'Barrel oscillation left blocked',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'bosr',
    'BARREL_OSCILLATION_RIGHT',
    'Barrel oscillation right blocked',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  ['com1', 'COMMS_AFM', 'COMMS_AFM', 'boolean', 'false', 'indicator', ''],
  [
    'sen1',
    'DUST_SENSOR',
    'Dust sensor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'sen2',
    'GAS_SENSOR',
    'Gas sensor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'sen3',
    'TEMPERATURE_SENSOR',
    'Temperature sensor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'sen4',
    'HUMIDITY_SENSOR',
    'Humidity sensor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'etws',
    'EVAPORATION_TRAY_OVERFLOW_EXTENDED',
    'EVAPORATION_TRAY_OVERFLOW_EXTENDED',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'wpmp',
    'WATER_PUMP_FAILURE',
    'A water pump failure has been detected.',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'prot',
    'PUMP_ROTOR',
    'Pump rotor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'uled',
    'UVC_LED',
    'Sanitizing UV-LED failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'fltr',
    'FILTER_REPLACEMENT',
    'At least one filter needs to be replaced.',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'tnke',
    'TANK_EMPTY',
    'Water tank is empty.',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'tnkp',
    'TANK_UNDETECTED',
    'Water tank could not be detected.',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'cldu',
    'CLEAN_CYCLE_OVERDUE',
    'Clean cycle is overdue.',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'etwd',
    'EVAPORATION_TRAY_OVERFLOW_DETECTED',
    'EVAPORATION_TRAY_OVERFLOW_DETECTED',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'cnfg',
    'BLDC_CONFIG_ERROR',
    'BLDC_CONFIG_ERROR',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'wdog',
    'WATCH_DOG_RESET',
    'WATCH_DOG_RESET',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  ['ibus', 'I2C_BUS', 'I2C BUS failure', 'boolean', 'false', 'indicator', ''],
  [
    'ilss',
    'ILLEGAL_SYSTEM_STATE',
    'Illegal system state',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'hioc',
    'GEN1_HEATER_INPUT_OVER_CURRENT',
    'GEN1_HEATER_INPUT_OVER_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'hilc',
    'GEN1_HEATER_INPUT_LOW_CURRENT',
    'GEN1_HEATER_INPUT_LOW_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'htri',
    'GEN1_HEATER_TRIAC',
    'GEN1_HEATER_TRIAC',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'hamb',
    'GEN1_HEATER_AMBIENT_TEMPERATURE_LOSS',
    'GEN1_HEATER_AMBIENT_TEMPERATURE_LOSS',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'povi',
    'GEN1_HEATER_PLUG_OVER_CURRENT',
    'GEN1_HEATER_PLUG_OVER_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'hctf',
    'GEN1_HEATER_TRIAC_COMMS',
    'GEN1_HEATER_TRIAC_COMMS',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'hvmi',
    'GEN1_HEATER_TRIAC_VARIANT',
    'GEN1_HEATER_TRIAC_VARIANT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'tilt',
    'GEN1_HEATER_TILT_DETECTION',
    'GEN1_HEATER_TILT_DETECTION',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht01',
    'GEN2_HEATER_INPUT_OVER_CURRENT',
    'GEN2_HEATER_INPUT_OVER_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht02',
    'GEN2_HEATER_INPUT_LOW_CURRENT',
    'GEN2_HEATER_INPUT_LOW_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht03',
    'GEN2_HEATER_TRIAC',
    'GEN2_HEATER_TRIAC',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht04',
    'GEN2_HEATER_PLUG_OVER_CURRENT',
    'GEN2_HEATER_PLUG_OVER_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht05',
    'GEN2_HEATER_TRIAC_VARIANT_MISMATCH',
    'GEN2_HEATER_TRIAC_VARIANT_MISMATCH',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht06',
    'GEN2_HEATER_AMBIENT_TEMPERATURE_LOSS',
    'GEN2_HEATER_AMBIENT_TEMPERATURE_LOSS',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht07',
    'GEN2_HEATER_TILT_SENSOR',
    'GEN2_HEATER_TILT_SENSOR',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht08',
    'GEN2_HEATER_ILLEGAL_COUNTRY',
    'GEN2_HEATER_ILLEGAL_COUNTRY',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht09',
    'GEN2_HEATER_VARIANT_ID_ERROR',
    'GEN2_HEATER_VARIANT_ID_ERROR',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ht0a',
    'GEN2_HEATER_CURRENT_SENSOR',
    'GEN2_HEATER_CURRENT_SENSOR',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'dsts',
    'PARTICLE_SENSOR',
    'Particle sensor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'vocs',
    'VOC_SENSOR',
    'VOC Sensor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    't&hs',
    'TEMPERATURE_HUMIDITY_SENSOR',
    'Temperature&Humidity sensor failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'fmco',
    'MOTOR_CONTROLLER',
    'Motor controller failure',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'stto',
    'BLDC_STALL_TIMEOUT',
    'BLDC_STALL_TIMEOUT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'hall',
    'BLDC_HALL_MONITOR',
    'BLDC_HALL_MONITOR',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'hamp',
    'BLDC_OVER_CURRENT',
    'BLDC_OVER_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'stal',
    'BLDC_STALL_CURRENT',
    'BLDC_STALL_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'shrt',
    'BLDC_SHORT_CURRENT',
    'BLDC_SHORT_CURRENT',
    'boolean',
    'false',
    'indicator',
    ''
  ],
  [
    'ste1',
    'PAN_OSCILLATION',
    'PAN Oscillation failure',
    'boolean',
    'false',
    'indicator',
    ''
  ]
];
