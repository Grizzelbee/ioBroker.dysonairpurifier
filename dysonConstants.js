// @ts-nocheck
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';


const FILTERTYPES = {'GCOM':'Combined', 'GHEP':'HEPA', 'CARF':'Activated carbon'};
module.exports.SUPPORTED_PRODUCT_TYPES = ['358', '438', '455', '469', '475', '520', '527', '527E'];
module.exports.PRODUCTS = {
    '358': {name:'Dyson Pure Humidify+Cool', icon:'icons/purifier-humidifiers.png'},
    '438': {name:'Dyson Pure Cool Tower', icon:'icons/purifiers.png'},
    '455': {name:'Dyson Pure Hot+Cool Link', icon:'icons/heaters.png'},
    '469': {name:'Dyson Pure Cool Link Desk', icon:'icons/fans.png'},
    '475': {name:'Dyson Pure Cool Link Tower', icon:'icons/purifiers.png'},
    '520': {name:'Dyson Pure Cool Desk', icon:'icons/fans.png'},
    '527': {name:'Dyson Pure Hot+Cool', icon:'icons/heaters.png'},
    '527E': {name:'Dyson Pure Hot+Cool', icon:'icons/heaters.png'}
};

// data structure to determine readable names, etc for any datapoint
// Every row is one state in a dyson message. Format: [ dysonCode, Name of Datapoint, Description, datatype, writable, role, unit, possible values for data field]
module.exports.DATAPOINTS = [
    ['channel', 'WIFIchannel'             , 'Number of the used WIFI channel.'                                              , 'number', 'false', 'value'             ,''  ],
    ['ercd' , 'LastErrorCode'             , 'Error code of the last error occurred on this device'                          , 'string', 'false', 'text'              ,''  ],
    ['filf' , 'FilterLife'                , 'Estimated remaining filter life in hours.'                                     , 'number', 'false', 'value'             , 'hours' ],
    ['fmod' , 'FanMode'                   , 'Mode of device'                                                                , 'string', 'false', 'switch'            ,'', {'FAN':'Fan', 'AUTO':'Auto'} ],
    ['fnsp' , 'FanSpeed'                  , 'Current fan speed'                                                             , 'string', 'true',  'switch'            ,'', {'AUTO':'Auto', '0001':'1', '0002':'2', '0003':'3', '0004':'4', '0005':'5', '0006':'6', '0007':'7', '0008':'8', '0009':'9', '0010':'10' } ],
    ['fnst' , 'FanStatus'                 , 'Current Fan state; correlating to Auto-mode'                                   , 'string', 'false', 'text'              ,'' ],
    ['nmod' , 'Nightmode'                 , 'Night mode state'                                                              , 'string', 'true',  'switch.mode.moonlight'  ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['qtar' , 'AirQualityTarget'          , 'Target Air quality for Auto Mode.'                                             , 'string', 'false', 'text'              ,''  ],
    ['rhtm' , 'ContinuousMonitoring'      , 'Continuous Monitoring of environmental sensors even if device is off.'         , 'string', 'true',  'switch'            ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['fpwr' , 'MainPower'                 , 'Main Power of fan.'                                                            , 'string', 'true',  'switch.power'      ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['auto' , 'AutomaticMode'             , 'Fan is in automatic mode.'                                                     , 'string', 'true',  'switch'            ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['nmdv' , 'NightModeMaxFan'           , 'Maximum fan speed in night mode.'                                              , 'number', 'false', 'value'             ,''  ],
    ['cflr' , 'CarbonfilterLifetime'      , 'Remaining lifetime of filter installed in activated carbon filter port.'       , 'number', 'false', 'value' 	 	     ,'%' ],
    ['fdir' , 'Flowdirection'             , 'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)'                , 'string', 'true',  'switch'            ,'', {'OFF': 'Back', 'ON': 'Front'} ],
    ['ffoc' , 'Flowfocus'                 , 'Direction the fan blows to. ON=Front; OFF=Back (aka Jet focus)'                , 'string', 'true',  'switch'            ,'', {'OFF': 'Back', 'ON': 'Front'} ],
    ['hflr' , 'HEPA-FilterLifetime'       , 'Remaining lifetime of filter installed in HEPA-Filter port.'                   , 'number', 'false', 'value'             ,'%' ],
    ['cflt' , 'Carbonfilter'              , 'Filter type installed in carbon filter port.'                                  , 'string', 'false', 'text'              ,'', FILTERTYPES ],
    ['hflt' , 'HEPA-Filter'               , 'Filter type installed in HEPA-filter port.'                                    , 'string', 'false', 'text'              ,'', FILTERTYPES ],
    ['sltm' , 'Sleeptimer'                , 'Sleep timer.'                                                                  , 'string', 'false', 'text'              ,''  ],
    ['oscs' , 'OscillationActive'         , 'Fan is currently oscillating.'                                                 , 'string', 'false', 'text'              ,'', {'IDLE':'Idle', 'OFF':'OFF', 'ON':'ON'} ],
    ['oson' , 'Oscillation'               , 'Oscillation of fan.'                                                           , 'string', 'true',  'switch'            ,'', {'OFF':'OFF', 'ON':'ON'} ],
    ['osal' , 'OscillationLeft'           , 'OscillationAngle Lower Boundary'                                               , 'string', 'true',  'text'              ,'°' ],
    ['osau' , 'OscillationRight'          , 'OscillationAngle Upper Boundary'                                               , 'string', 'true',  'text'              ,'°' ],
    ['ancp' , 'OscillationAngle'          , 'OscillationAngle'                                                              , 'string', 'true',  'text'              ,'°', {0:'0', 15:'15', 30:'30', 45:'45', 90:'90', 180:'180', 270:'270', 350:'350', 'CUST':'CUST'} ],
    ['rssi' , 'RSSI'                      , 'Received Signal Strength Indication. Quality indicator for WIFI signal.'       , 'number', 'false', 'value'             ,'dBm' ],
    ['pact' , 'Dust'                      , 'Dust'                                                                          , 'number', 'false', 'value'             ,''  ],
    ['hact' , 'Humidity'                  , 'Humidity'                                                                      , 'number', 'false', 'value.humidity'    ,'%' ],
    ['sltm' , 'Sleeptimer'                , 'Sleep timer'                                                                   , 'number', 'false', 'value'             ,'Min' ],
    ['tact' , 'Temperature'               , 'Temperature'                                                                   , 'number', 'false', 'value.temperature' ,'' ],
    ['vact' , 'VOC'                       , 'VOC - Volatile Organic Compounds'                                              , 'number', 'false', 'value'             ,'' ],
    ['pm25' , 'PM25'                      , 'PM2.5 - Particulate Matter 2.5µm'                                              , 'number', 'false', 'value'             ,'µg/m³' ],
    ['pm10' , 'PM10'                      , 'PM10 - Particulate Matter 10µm'                                                , 'number', 'false', 'value'             ,'µg/m³' ],
    ['va10' , 'VOC'                       , 'VOC - Volatile Organic Compounds (inside)'                                     , 'number', 'false', 'value'             ,'' ],
    ['noxl' , 'NO2'                       , 'NO2 - Nitrogen dioxide (inside)'                                               , 'number', 'false', 'value'             ,'' ],
    ['p25r' , 'PM25R'                     , 'PM-2.5R - Particulate Matter 2.5µm'                                            , 'number', 'false', 'value'             ,'µg/m³' ],
    ['p10r' , 'PM10R'                     , 'PM-10R - Particulate Matter 10µm'                                              , 'number', 'false', 'value'             ,'µg/m³' ],
    ['hmod' , 'HeaterMode'                , 'Heating Mode [ON/OFF]'                                                         , 'string', 'true',  'switch'            ,'', {'OFF': 'OFF', 'ON': 'ON'} ],
    ['hmax' , 'TemperatureTarget'         , 'Target temperature for heating'                                                , 'number', 'true',  'value.temperature' ,'' ],
    ['hume' , 'HumidificationMode'        , 'HumidificationMode Switch [ON/OFF]'                                            , 'string', 'true', 'switch'             ,'', {'OFF': 'OFF', 'HUMD': 'ON'} ],
    ['haut' , 'HumidifyAutoMode'          , 'Humidify AutoMode [ON/OFF]'                                                    , 'string', 'true', 'switch'             ,'', {'OFF': 'OFF', 'ON': 'ON'} ],
    ['humt' , 'HumidificationTarget'      , 'Manual Humidification Target'                                                  , 'number', 'true', 'value'              ,'%' ],
    ['cdrr' , 'CleanDurationRemaining'    , 'Clean Duration Remaining'                                                      , 'number', 'false', 'value'              ,'' ],
    ['rect' , 'AutoHumidificationTarget'  , 'Auto Humidification target'                                                    , 'number', 'true', 'value'              ,'%' ],
    ['cltr' , 'TimeRemainingToNextClean'  , 'Time Remaining to Next Clean'                                                  , 'number', 'false', 'value'              ,'hours' ],
    ['wath' , 'WaterHardness'             , 'Water Hardness'                                                                , 'number', 'true', 'value'              ,'', {675: 'Hard', 1350:'Medium', 2025:'Soft'}]
];