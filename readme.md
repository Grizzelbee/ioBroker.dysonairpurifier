# ioBroker.dysonAirPurifier

![Logo](admin/dyson_logo.svg)![Logo](admin/dyson_pure_cool.jpg)  

![Number of Installations (latest)](http://iobroker.live/badges/dysonairpurifier-installed.svg)
[![NPM version](https://img.shields.io/npm/v/iobroker.dysonairpurifier.svg)](https://www.npmjs.com/package/iobroker.dysonairpurifier)
![Number of Installations (stable)](http://iobroker.live/badges/dysonairpurifier-stable.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.dysonairpurifier.svg)](https://www.npmjs.com/package/iobroker.dysonairpurifier)
[![Dependency Status](https://img.shields.io/david/Grizzelbee/iobroker.dysonairpurifier.svg)](https://david-dm.org/Grizzelbee/iobroker.dysonairpurifier)
[![Known Vulnerabilities](https://snyk.io/test/github/Grizzelbee/ioBroker.dysonairpurifier/badge.svg)](https://snyk.io/test/github/Grizzelbee/ioBroker.dysonairpurifier)
[![Travis-CI](https://travis-ci.org/Grizzelbee/iobroker.dysonairpurifier.svg?branch=master)](https://travis-ci.com/github/Grizzelbee/iobroker.dysonairpurifier)

[![NPM](https://nodei.co/npm/iobroker.dysonAirPurifier.svg?downloads=true)](https://nodei.co/npm/iobroker.dysonairpurifier/)
  
## ioBroker Adapter for dyson Air Purifiers and fans
This adapter connects ioBroker to various dyson Air Purifiers.

<div>Fan-Icon in Logo created by <a href="https://www.flaticon.com/de/autoren/freepik" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/de/" title="Flaticon">www.flaticon.com</a></div>

### supported devices
#### Tested
* 2018 Dyson Pure Cool Tower (TP04)
* 2018 Dyson Pure Hot+Cool   (HP04)
* Dyson Pure Cool Link Tower (TP02)

#### Should work
* Dyson Pure Humidify+Cool (PH01)
* 2018 Dyson Pure Cool Desk (DP04)
* Dyson Pure Hot+Cool Link (HP02)
* Dyson Pure Cool Link Desk (DP01)

## Features

## Installation
Install from STABLE or LATEST repository or from github - depending what stability you prefer.

### Prerequisites
* To get this adapter running you'll need a dyson account.
* Make sure to add your fan to your account. Either via App or online.

### Config-data needed
* dyson account username
* dyson account password
* your ISO-Country code (DE, US, CA, ...). This will mostly be the country you opened your dyson account in.
* your fans/air purifiers IP address in your LAN.
Due to early development state and a non conform mDNS implementation by dyson you'll need to provide the local fans IP after the first run.
On the first start of this adapter the dyson API is queried for all your devices and all supported devices will be created in the devicetree - with it's basic information provided by the API and an additional field "Hostaddress".
So please run the adapter and your air purifiers get created in the devicetree with their basic information. 
Then stop the adapter, place the IP into field Hostaddress and restart the adapter. After that all your air purifiers should get populated. 

## Changelog
### Todo:
* detect IP of devices automatically
* Add more country codes
* remove deprecated library crypto
* test with more different devices
* collect more mqtt message acronym meanings
* calculate filter life in % not in hours

### known issues:
 * No automatic IP detection of devices
 

### 0.4.1 (2020-10-01)
 * (grizzelbee) Fix: removed unnessecary updateInterval. Statechanges are propagated automatically.
 * (grizzelbee) New: Added some Hot&Cool specific datafields

### 0.4.0 (2020-09-29)
 * (grizzelbee) New: devices are now **controllable**
 * (grizzelbee) New: state-change-messages are processed correctly now
 * (grizzelbee) Fix: Added missing °-Sign to temperature unit
 * (grizzelbee) Fix: Terminating adapter when starting with missing dyson credentials.
 * (grizzelbee) Fix: NO2 and VOC Indices should work now
 * (grizzelbee) Fix: Fixed build errors
 
 
### 0.3.0 (2020-09-27) - first version worth giving it a try
* (grizzelbee) New: Messages received via Web-API and MQTT getting processed
* (grizzelbee) New: datapoints getting created and populated
* (grizzelbee) New: Added config item for desired temperature unit (Kelvin, Fahrenheit, Celsius).
* (grizzelbee) New: Added missing product names to product numbers
* (grizzelbee) New: Hostaddress/IP is editable / configurable
* (grizzelbee) New: calculate quality indexes for PM2.5, PM10, VOC and NO2 according to dyson App 

### 0.2.0 (2020-09-22) - not working! Do not install/use
* (grizzelbee) New: Login to dyson API works
* (grizzelbee) New: Login to dyson AirPurifier (2018 Dyson Pure Cool Tower [TP04]) works
* (grizzelbee) New: mqtt-Login to [TP04] works
* (grizzelbee) New: mqtt-request from [TP04] works
* (grizzelbee) New: mqtt-request to [TP04] is responding

### 0.1.0 (2020-09-04) - not working! Do not install/use
* (grizzelbee) first development body (non functional)


# Data explanation
Information copied and extended from https://github.com/shadowwa/Dyson-MQTT2RRD/blob/master/README.md

## CURRENT-STATE

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| mode-reason | Current Mode has been set by RemoteControl, App, Scheduler | PRC, LAPP, LSCH| |
| state-reason | | MODE | |  
| rssi | WIFI Strength| -100 - 0| dBm|
| channel| WIFI Channel| 52 | |
| fqhp | | 96704 | |
| fghp | | 70480 | |


### product-state

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| ercd | Last Error Code | NONE , or some hexa values |  |
| filf | remaining Filter life | 0000 - 4300 | hours|
| fmod | Mode | FAN , AUTO | |
| fnsp | Fan speed | 0001 - 0010, AUTO | |
| fnst | Fan Status | ON , OFF, FAN | |
| nmod | Night mode | ON , OFF | |
| oson | Oscillation | ON , OFF | |
| qtar | Air Quality target | 0001 , 0003... | |
| rhtm | Continious Monitoring | ON, OFF | |
| wacd | ? | NONE... | |
| fpwr | Main Power | ON, OFF | |
| auto | AutomaticMode | ON, OFF | |
| oscs | OscillationActive | ON, OFF, IDLE | |
| nmdv | NightMode Max Fanspeed? | 0004 | |
| bril |  AirQualityIndex| 0002 | LuQx |  
| corf |  | ON, OFF | |
| cflr | Status Coalfilter  | 0000 - 0100 | Percent |
| hflr | Status HEPA-Filter | 0000 - 0100 | Percent |
| cflt | Carbonfilter | CARF | |
| hflt | HEPAfilter | GHEP | |
| sltm | Sleeptimer | ON, OFF ||
| osal | Oscilation left degrees | 0005 - 355| °  (degrees)|
| osau | Oscilation right degrees | 0005 - 355 | °  (degrees)|
| ancp | Ancorpoint for oscilation ?  | CUST, 0180 |° (degrees)|
| fdir | Fandirection / ON=Front, OFF=Back | ON, OFF | | 
| hmod | Heating Mode | ON, OFF | | 
| hmax | Target temperature for heating | 0 .. 5000 | K | 
| hume | Dehumidifier State     | ON, OFF, |
| haut | Target Humidifier Dehumidifier State| |
| humt | Relative Humidity Humidifier Threshold| |

|Error-Codes| Meaning |
| ----- | ----- |
| NONE | There is no error active |
|57C2| unknown |
|11E1| Oscilation has been disabled. Please press Button "Oscilation" on your remote to continue.|




### scheduler

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| dstv | daylightSavingTime | 0001... | |
| srsc | ? | 7c68... | |
| tzid | timezone? | 0001... | |

## ENVIRONMENTAL-CURRENT-SENSOR-DATA

### data

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| hact | Humidity (%) | 0000 - 0100 | Percent |
| pact | Dust | 0000 - 0009 | |
| sltm | Sleeptimer | OFF... 9999 | Minutes |
| tact | Temperature in Kelvin | 0000 - 5000 | K|
| vact | volatil organic compounds | 0001 - 0009 | |
|pm25|  PM2.5 |0018||
|pm10|  PM10 |0011||
|va10|  volatil organic compounds|0004||
|noxl|  NO2 |0005||
|p25r|  |0019||
|p10r|  |0018||

## ENVIRONMENTAL-AND-USAGE-DATA

Redundant values?

### data

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| pal0 - pal9 | number of second spend in this level of dust since the begining of hour | 0000 - 3600 | |
| palm | seems to be a median value of palX |  | |
| vol0 - vol9 | number of second spend in this level of voc since the begining of hour | 0000 - 3600 | |
| volm | seems to be a median value of volX |  | |
| aql0 - aql9 | number of second spend in this level of air quality | max (pal, vol)) since the begining of hour | 0000 - 3600 | |
| aqlm | seems to be a median value of aqlX |  | |
| fafs | seems to be a number of seconds spend in a specific time | 0000 - 3600 | |
| faos | seems to be a number of seconds spend in a specific time | 0000 - 3600 | |
| fofs | seems to be a number of seconds spend in a specific time | 0000 - 3600 | |
| fons | seems to be a number of seconds spend in a specific time | 0000 - 3600 | |
| humm | humidity ? (%) | 0000 - 0100 | |
| tmpm | temperature in kelvin ? | 0000 - 5000 | |


## Legal Notices
dyson, pure cool, pure hot & cool, and others are trademarks or registered trademarks of dyson ltd.
<https://www.dyson.com>

All other trademarks are the property of their respective owners.

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Copyright (c) 2020 Hanjo Hingsen <hanjo@hingsen.de>
