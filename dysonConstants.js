// @ts-nocheck
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const dysonConstant= require('./dysonConstants');

module.exports.API_BASE_URI = 'https://appapi.cp.dyson.com';
module.exports.HTTP_HEADERS = {
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 8.1.0; Google Build/OPM6.171019.030.E1)',
    'Content-Type': 'application/json'
};

const FILTERTYPES = {'GCOM':'Combined', 'GHEP':'HEPA', 'CARF':'Activated carbon'};
const BOOL_SWITCH = {false:'Off', true:'On'};

module.exports.LOAD_FROM_PRODUCTS=999;
module.exports.SUPPORTED_PRODUCT_TYPES = ['358', '438', '438E', '455', '455A', '469', '475', '520', '527', '527E'];
module.exports.PRODUCTS = {
    '358' : {name:'Dyson Pure Humidify+Cool', icon:'icons/purifier-humidifiers.png', 'ancp':{0:'0', 45:'45', 90:'90', 'BRZE':'Breeze'}},
    '438' : {name:'Dyson Pure Cool Tower', icon:'icons/purifiers.png', 'ancp':{0:'0', 45:'45', 90:'90', 180:'180', 350:'350', 'CUST':'Custom'}},
    '438E': {name:'Dyson Pure Cool Tower Formaldehyde', icon:'icons/purifiers.png', 'ancp':{0:'0', 45:'45', 90:'90', 180:'180', 350:'350', 'CUST':'Custom'}},
    '455' : {name:'Dyson Pure Hot+Cool Link', icon:'icons/heaters.png', 'ancp':{0:'0', 45:'45', 90:'90', 180:'180', 350:'350', 'CUST':'Custom'}},
    '455A': {name:'Dyson Pure Hot+Cool Link', icon:'icons/heaters.png', 'ancp':{0:'0', 45:'45', 90:'90', 180:'180', 350:'350', 'CUST':'Custom'}},
    '469' : {name:'Dyson Pure Cool Link Desk', icon:'icons/fans.png', 'ancp':{}},
    '475' : {name:'Dyson Pure Cool Link Tower', icon:'icons/purifiers.png', 'ancp':{0:'0', 45:'45', 90:'90', 180:'180', 350:'350', 'CUST':'Custom'}},
    '520' : {name:'Dyson Pure Cool Desk', icon:'icons/fans.png', 'ancp':{}},
    '527' : {name:'Dyson Pure Hot+Cool', icon:'icons/heaters.png', 'ancp':{0:'0', 45:'45', 90:'90', 180:'180', 350:'350', 'CUST':'Custom'}},
    '527E': {name:'Dyson Pure Hot+Cool', icon:'icons/heaters.png', 'ancp':{0:'0', 45:'45', 90:'90', 180:'180', 350:'350', 'CUST':'Custom'}}
};

// data structure to determine readable names, etc for any datapoint
// Every row is one state in a dyson message. Format: [ 0-dysonCode, 1-Name of Datapoint, 2-Description, 3-datatype, 4-writeable, 5-role, 6-unit, 7-possible values for data field]
module.exports.DATAPOINTS = [
    ['channel', 'WIFIchannel'             , 'Number of the used WIFI channel.'                                              , 'number',  'false', 'value'             ,''  ],
    ['ercd' , 'LastErrorCode'             , 'Error code of the last error occurred on this device'                          , 'string',  'false', 'text'              ,''  ],
    ['filf' , 'FilterLife'                , 'Estimated remaining filter life in hours.'                                     , 'number',  'false', 'value'             , 'hours' ],
    ['fmod' , 'FanMode'                   , 'Mode of device'                                                                , 'string',  'true',  'switch'            ,'', {'FAN':'Manual', 'AUTO':'Auto', 'OFF':'Off'} ],
    ['fnsp' , 'FanSpeed'                  , 'Current fan speed'                                                             , 'string',  'true',  'switch'            ,'', {'AUTO':'Auto', '0001':'1', '0002':'2', '0003':'3', '0004':'4', '0005':'5', '0006':'6', '0007':'7', '0008':'8', '0009':'9', '0010':'10' } ],
    ['fnst' , 'FanStatus'                 , 'Current Fan state; correlating to Auto-mode'                                   , 'string',  'false', 'text'              ,'' ],
    ['nmod' , 'Nightmode'                 , 'Night mode state'                                                              , 'boolean', 'true',  'switch.mode.moonlight'  ,'', BOOL_SWITCH ],
    ['qtar' , 'AirQualityTarget'          , 'Target Air quality for Auto Mode.'                                             , 'string',  'true', 'text'              ,'', {'0001':'0001', '0002':'0002', '0003':'0003', '0004':'0004'}  ],
    ['rhtm' , 'ContinuousMonitoring'      , 'Continuous Monitoring of environmental sensors even if device is off.'         , 'boolean', 'true',  'switch'            ,'', BOOL_SWITCH ],
    ['fpwr' , 'MainPower'                 , 'Main Power of fan.'                                                            , 'boolean', 'true',  'switch.power'      ,'', BOOL_SWITCH ],
    ['auto' , 'AutomaticMode'             , 'Fan is in automatic mode.'                                                     , 'boolean', 'true',  'switch'            ,'', BOOL_SWITCH ],
    ['nmdv' , 'NightModeMaxFan'           , 'Maximum fan speed in night mode.'                                              , 'number',  'false', 'value'             ,''  ],
    ['cflr' , 'CarbonfilterLifetime'      , 'Remaining lifetime of filter installed in activated carbon filter port.'       , 'number',  'false', 'value' 	 	     ,'%' ],
    ['fdir' , 'Flowdirection'             , 'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)'                , 'boolean', 'true',  'switch'            ,'', {false: 'Back', true: 'Front'} ],
    ['ffoc' , 'Flowfocus'                 , 'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)'                , 'boolean', 'true',  'switch'            ,'', {false: 'Back', true: 'Front'} ],
    ['hflr' , 'HEPA-FilterLifetime'       , 'Remaining lifetime of filter installed in HEPA-Filter port.'                   , 'number',  'false', 'value'             ,'%' ],
    ['cflt' , 'Carbonfilter'              , 'Filter type installed in carbon filter port.'                                  , 'string',  'false', 'text'              ,'', FILTERTYPES ],
    ['hflt' , 'HEPA-Filter'               , 'Filter type installed in HEPA-filter port.'                                    , 'string',  'false', 'text'              ,'', FILTERTYPES ],
    ['sltm' , 'Sleeptimer'                , 'Sleep timer.'                                                                  , 'string',  'false', 'text'              ,''  ],
    ['oscs' , 'OscillationActive'         , 'Fan is currently oscillating.'                                                 , 'string',  'false', 'text'              ,'', {'IDLE':'Idle', 'OFF':'OFF', 'ON':'ON'} ],
    ['oson' , 'Oscillation'               , 'Oscillation of fan.'                                                           , 'boolean', 'true',  'switch'            ,'', BOOL_SWITCH ],
    ['osal' , 'OscillationLeft'           , 'OscillationAngle Lower Boundary'                                               , 'number',  'true',  'text'              ,'°' ],
    ['osau' , 'OscillationRight'          , 'OscillationAngle Upper Boundary'                                               , 'number',  'true',  'text'              ,'°' ],
    ['ancp' , 'OscillationAngle'          , 'OscillationAngle'                                                              , 'string',  'true',  'text'              ,'°', dysonConstant.LOAD_FROM_PRODUCTS ],
    ['rssi' , 'RSSI'                      , 'Received Signal Strength Indication. Quality indicator for WIFI signal.'       , 'number',  'false', 'value'             ,'dBm' ],
    ['pact' , 'Dust'                      , 'Dust'                                                                          , 'number',  'false', 'value'             ,''  ],
    ['hact' , 'Humidity'                  , 'Humidity'                                                                      , 'number',  'false', 'value.humidity'    ,'%' ],
    ['sltm' , 'Sleeptimer'                , 'Sleep timer'                                                                   , 'number',  'false', 'value'             ,'Min' ],
    ['tact' , 'Temperature'               , 'Temperature'                                                                   , 'string',  'false', 'value.temperature' ,'' ],
    ['vact' , 'VOC'                       , 'VOC - Volatile Organic Compounds'                                              , 'number',  'false', 'value'             ,'' ],
    ['pm25' , 'PM25'                      , 'PM2.5 - Particulate Matter 2.5µm'                                              , 'number',  'false', 'value'             ,'µg/m³' ],
    ['pm10' , 'PM10'                      , 'PM10 - Particulate Matter 10µm'                                                , 'number',  'false', 'value'             ,'µg/m³' ],
    ['va10' , 'VOC'                       , 'VOC - Volatile Organic Compounds (inside)'                                     , 'number',  'false', 'value'             ,'' ],
    ['noxl' , 'NO2'                       , 'NO2 - Nitrogen dioxide (inside)'                                               , 'number',  'false', 'value'             ,'' ],
    ['p25r' , 'PM25R'                     , 'PM-2.5R - Particulate Matter 2.5µm'                                            , 'number',  'false', 'value'             ,'µg/m³' ],
    ['p10r' , 'PM10R'                     , 'PM-10R - Particulate Matter 10µm'                                              , 'number',  'false', 'value'             ,'µg/m³' ],
    ['hcho' , 'Formaldehyde'              , 'Current formaldehyde level'                                                    , 'number',  'false', 'value'             ,'mg/m³' ],
    ['hmod' , 'HeaterMode'                , 'Heating Mode [ON/OFF]'                                                         , 'boolean', 'true',  'switch'            ,'', BOOL_SWITCH ],
    ['hmax' , 'TemperatureTarget'         , 'Target temperature for heating'                                                , 'string',  'true',  'value.temperature' ,'' ],
    ['hume' , 'HumidificationMode'        , 'HumidificationMode Switch [ON/OFF]'                                            , 'boolean', 'true', 'switch'             ,'', {false: 'Off', true: 'On'} ],
    ['haut' , 'HumidifyAutoMode'          , 'Humidify AutoMode [ON/OFF]'                                                    , 'boolean', 'true', 'switch'             ,'', BOOL_SWITCH ],
    ['humt' , 'HumidificationTarget'      , 'Manual Humidification Target'                                                  , 'number',  'true', 'value'              ,'%' , {'0030':30, '0040':40, '0050':50, '0060':60, '0070':70}],
    ['cdrr' , 'CleanDurationRemaining'    , 'Time remaining in deep clean cycle'                                            , 'number',  'false', 'value'             ,'Min' ],
    ['rect' , 'AutoHumidificationTarget'  , 'Auto Humidification target'                                                    , 'number',  'true', 'value'              ,'%' ],
    ['clcr' , 'DeepCleanCycle'            , 'Indicates whether a deep cleaning cycle is in progress or not.'                , 'string',  'false', 'text'              ,'', {'CLNO':'Inactive', 'CLCM':'Completed', 'CLAC':'Active'} ],
    ['cltr' , 'TimeRemainingToNextClean'  , 'Time remaining to Next deep clean cycle.'                                      , 'number',  'false', 'value'             ,'hours' ],
    ['corf' , 'TemperatureUnit'           , 'Unit to display temperature values in (Fan display).'                          , 'boolean', 'true', 'switch'            ,'', {true:'Celsius', false:'Fahrenheit' }],
    ['hsta' , 'HeatingState'              , 'Active/Idle'                                                                   , 'string',  'false', 'value'             ,'', {'OFF':'Idle', 'HEAT':'Active'}],
    ['msta' , 'HumidificationState'       , 'Active/Idle'                                                                   , 'string',  'false', 'value'             ,'', {'OFF':'Idle', 'HUMD':'Active'}],
    ['wath' , 'WaterHardness'             , 'Water Hardness'                                                                , 'string',  'true', 'value'              ,'', {'0675': 'Hard', '1350':'Medium', '2025':'Soft'}]
];