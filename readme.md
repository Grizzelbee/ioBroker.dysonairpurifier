# ioBroker.dysonAirPurifier

![Logo](admin/dyson_logo.svg)![Logo](admin/dyson_pure_cool.jpg)  

![Number of Installations (latest)](http://iobroker.live/badges/dysonairpurifier-installed.svg)
[![NPM version](https://img.shields.io/npm/v/iobroker.dysonairpurifier.svg)](https://www.npmjs.com/package/iobroker.dysonairpurifier)
![Number of Installations (stable)](http://iobroker.live/badges/dysonairpurifier-stable.svg)
[![Dependency Status](https://img.shields.io/david/Grizzelbee/iobroker.dysonairpurifier.svg)](https://david-dm.org/Grizzelbee/iobroker.dysonairpurifier)
[![Known Vulnerabilities](https://snyk.io/test/github/Grizzelbee/ioBroker.dysonairpurifier/badge.svg)](https://snyk.io/test/github/Grizzelbee/ioBroker.dysonairpurifier)
[![Travis-CI](https://travis-ci.org/Grizzelbee/iobroker.dysonairpurifier.svg?branch=master)](https://travis-ci.com/github/Grizzelbee/iobroker.dysonairpurifier)

[![NPM](https://nodei.co/npm/iobroker.dysonAirPurifier.svg?downloads=true)](https://nodei.co/npm/iobroker.dysonairpurifier/)

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://github.com/grizzelbee/iobroker.dysonairpurifier/blob/master/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/iobroker.dysonairpurifier.svg)](https://www.npmjs.com/package/iobroker.dysonairpurifier)

## ioBroker Adapter for Dyson Air Purifiers and fans

This adapter connects ioBroker to various Dyson Air Purifiers.

Fan-Icon in Logo created by [Freepik](https://www.flaticon.com/de/autoren/freepik) from [www.flaticon.com](https://www.flaticon.com/de/).

### supported devices

* Dyson Pure Cool Link Tower (TP02, ProductType 475)
* Dyson Pure Cool Tower, 2018 model (TP04, ProductType 438)
* Dyson Pure Cool Link Desk (DP01, ProductType 469)
* Dyson Pure Cool Desk, 2018 model (DP04, ProductType 520)
* Dyson Pure Hot+Cool Link (HP02, ProductType 455)
* 2018 Dyson Pure Hot+Cool (HP04, ProductType 527)
* Dyson Pure Humidify+Cool (PH01, ProductType 358)

## Features

Connects your Dyson fans, fan heaters, air purifiers, and air humidifiers to ioBroker.

* Reads values from devices and sensors
* Can control devices by giving you the ability to change some values (main power, oscillation, heating, fan speed, ...)
* Reads device list from Dyson servers

## Installation

### Prerequisites

* This adapter needs Node.js >= version 10
* To get this adapter running you'll need a Dyson account.
* Make sure to add your fan to your account. Either via App or online.

### Adapter installation

#### Using npm

Run ```npm install ioBroker.dysonairpurifier``` on your ioBroker installation to grab the latest version of this adapter from the npm repository.

#### Alternative: Using GitHub URL

Install through the ioBroker Admin UI by pointing it to the latest stable release on GitHub:
<https://github.com/Grizzelbee/ioBroker.dysonairpurifier/tarball/master/>

You can also install older release versions using this methods (by pointing to a version tag, e.g., ```v0.6.0``` instead of ```master```in the URL), but the most recent one is generally preferred.

### Config-data needed

* Dyson account username
* Dyson account password (this adapter can handle passwords up to 32 characters)
* your fans/air purifiers IP address in your LAN.

*Please note*: Due to early development state and a non conform mDNS implementation by Dyson you'll need to provide the local IP of the device *after the first run*.

> On the first start of this adapter the Dyson API is queried for all your devices and all supported devices will be created in the devicetree -- with their basic information provided by the API and an additional field "Hostaddress".
>
> So please run the adapter once and your Dyson devices will be created in the device tree with their basic settings.
>
> Then stop the adapter, enter the IP(s) into the Hostaddress field(s) and restart the adapter. After that your Dyson devices in the device tree should be populated with data.

## Changelog

### Todo

* detect IP of devices automatically
* collect more mqtt message acronym meanings
* test with more different devices

### Known issues

* No automatic IP detection of devices

### 0.7.0 (2020-11-xx) (Afraid of the dark)

* (jpwenzel)   New: Removing crypto from package dependency list (using Node.js provided version)
* (jpwenzel)   New: Introducing unit tests
* (jpwenzel)   Fix: general overhaul of readme
* (jpwenzel)   Fix: Code refactoring
* (grizzelbee) Fix: fixed some datafield names - please delete the whole device folder and get them newly created.
* (grizzelbee) Fix: [#18](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/18) - Fixed creating the indexes when there is no according sensor
* (grizzelbee) Fix: [#13](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/13) - Displaying Filter life value in hours again
* (grizzelbee) Fix: [#13](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/13) - Creating additional Filter life value in percent
* (grizzelbee) New: [#23](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/23) - Introduced new data field AirQuality which represents the worst value of all present indexes.

### 0.6.0 (2020-10-29) (Rage before the storm)

* (grizzelbee) Fix: [#13](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/13) - Filter life value is now displayed in percent not in hours
* (grizzelbee) New: [#17](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/17) - Added online-indicator for each device
* (grizzelbee) New: [#19](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/19) - Extended Password length from 15 characters to 32
* (grizzelbee) New: [#20](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/20) - Improved errorhandling on http communication with Dyson API
* (grizzelbee) Fix: Fixed typo within data field anchorpoint - please delete the old ancorpoint manually.

### 0.5.1 (2020-10-27) (Heart of the hurricance)

* (grizzelbee) Fix: Added missing clearTimeout

### 0.5.0 (2020-10-27) (Heart of the hurricance)

* (grizzelbee) Fix: [#13](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/13) - Filter life value is now displayed in percent not in hours
* (grizzelbee) Fix: [#6](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/6) - Changing the fanspeed does now fully work.  
* (grizzelbee) New: Editable data fields have now appropiate value lists
* (grizzelbee) New: Added more country codes
* (grizzelbee) New: Target temperature of heater can now be set - **in the configured unit!**

### 0.4.1 (2020-10-16) (unbroken)

* (grizzelbee) New: [#8](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/8) - Documented ProductTypes for better overview and user experience in ReadMe
* (grizzelbee) New: [#9](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/9) - Added some Hot&Cool specific datafields
* (grizzelbee) New: Logging of from devices, when shutting down the adapter
* (grizzelbee) New: [#10](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/10) - Pollig device data every X (configurable) seconds for new data, hence sensors don't send updates on changing values
* (grizzelbee) New: [#11](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/11) - Added Austria and France to Country-List
* (grizzelbee) Fix: Fixed bug in error handling when login to Dyson API fails
* (grizzelbee) Fix: [#12](https://github.com/Grizzelbee/ioBroker.dysonairpurifier/issues/12) - Fixed Dyson API login by completely securing via HTTPS.
* (grizzelbee) Fix: Updated some descriptions in config
  
### 0.4.0 (2020-09-29)

* (grizzelbee) New: devices are now **controllable**
* (grizzelbee) New: state-change-messages are processed correctly now
* (grizzelbee) Fix: Added missing °-Sign to temperature unit
* (grizzelbee) Fix: Terminating adapter when starting with missing Dyson credentials
* (grizzelbee) Fix: NO2 and VOC Indices should work now
* (grizzelbee) Fix: Fixed build errors

### 0.3.0 (2020-09-27) - first version worth giving it a try

* (grizzelbee) New: Messages received via Web-API and MQTT getting processed
* (grizzelbee) New: datapoints getting created and populated
* (grizzelbee) New: Added config item for desired temperature unit (Kelvin, Fahrenheit, Celsius)
* (grizzelbee) New: Added missing product names to product numbers
* (grizzelbee) New: Hostaddress/IP is editable / configurable
* (grizzelbee) New: calculate quality indexes for PM2.5, PM10, VOC and NO2 according to Dyson App

### 0.2.0 (2020-09-22) - not working! Do not install/use

* (grizzelbee) New: Login to Dyson API works
* (grizzelbee) New: Login to Dyson AirPurifier (2018 Dyson Pure Cool Tower [TP04]) works
* (grizzelbee) New: mqtt-Login to [TP04] works
* (grizzelbee) New: mqtt-request from [TP04] works
* (grizzelbee) New: mqtt-request to [TP04] is responding

### 0.1.0 (2020-09-04) - not working! Do not install/use

* (grizzelbee) first development body (non functional)

## Explanation of Dyson API data (message payload)

Information copied and extended from <https://github.com/shadowwa/Dyson-MQTT2RRD/blob/master/README.md>

### CURRENT-STATE

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| mode-reason | Current Mode has been set by RemoteControl, App, Scheduler | PRC, LAPP, LSCH, PUI | |
| state-reason | | MODE | |  
| rssi | WIFI Strength| -100 - 0| dBm|
| channel| WIFI Channel| 52 | |
| fqhp | | 96704 | |
| fghp | | 70480 | |

#### product-state

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| ercd | Last Error Code | NONE , or some hexa values |  |
| filf | remaining Filter life | 0000 - 4300 | hours|
| fmod | Mode | FAN , AUTO | |
| fpwr | Main Power | ON, OFF | |
| fnst | Fan Status | ON , OFF, FAN | |
| fnsp | Fan speed | 0001 - 0010, AUTO | |
| fdir | Fandirection / ON=Front, OFF=Back | ON, OFF | |
| ffoc | JetFocus | ON, OFF |
| nmod | Night mode | ON , OFF | |
| oson | Oscillation | ON , OFF , OIOF| |
| osal | Oscilation left degrees | 0005 - 355| °  (degrees)|
| osau | Oscilation right degrees | 0005 - 355 | °  (degrees)|
| oscs | OscillationActive | ON, OFF, IDLE | |
| ancp | Ancorpoint for oscilation ?  | CUST, 0180 |° (degrees)|
| qtar | Air Quality target | 0001 , 0003... | |
| rhtm | Continious Monitoring | ON, OFF | |
| auto | AutomaticMode | ON, OFF | |
| nmdv | NightMode Max Fanspeed? | 0004 | |
| cflr | Status Carbonfilter  | 0000 - 0100 | Percent |
| cflt | Carbonfilter | CARF | |
| hflr | Status HEPA-Filter | 0000 - 0100 | Percent |
| hflt | HEPA-Filter | GHEP | |
| sltm | Sleeptimer | ON, OFF ||
| hmod | Heating Mode | HEAT | |
| hmax | Target temperature for heating | 0 .. 5000 | K |
| hume | Humidifier State     | ON, OFF, |
| haut | Target Humidifier Dehumidifier State| |
| humt | Relative Humidity Humidifier Threshold| |
| wacd | WarningCode? | NONE... | |
| bril |  | 0002 |  |  
| corf |  | ON, OFF | |
| psta | [HP0x] Unknown |  | |
| hsta | [HP0x] Unknown |  | |
| tilt | [HP0x] Unknown |  | |
| dial | [DP0x] Unknown |  | |

|Error-Codes| Meaning |
| ----- | ----- |
| NONE | There is no error active |
|57C2| unknown |
|11E1| Oscilation has been disabled. Please press Button "Oscilation" on your remote to continue.|

#### scheduler

| name | meaning | possible values | Unit |
| ------------- | ----- | ----- | ----- |
| dstv | daylightSavingTime | 0001... | |
| srsc | ? | 7c68... | |
| tzid | timezone? | 0001... | |

### ENVIRONMENTAL-CURRENT-SENSOR-DATA

#### data

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
|noxl|  NO2 |0000 - 0014||
|p25r|  |0019||
|p10r|  |0018||

### ENVIRONMENTAL-AND-USAGE-DATA

Redundant values?

#### data

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

Dyson, pure cool, pure hot & cool, and others are trademarks or registered trademarks of [Dyson Ltd.](https://www.dyson.com)
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
