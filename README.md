
# Brushless Motors Testing Stand (React App for ESP32)



## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Project Structure](#project-structure)
- [ESP32 Configuration](#esp32-configuration)
- [Libraries and Dependencies](#libraries-and-dependencies)

## Introduction

This readme will be updated later. Only some general info is here yet.

## Getting Started

### Prerequisites

- Node.js and npm installed
- PlatformIO IDE or CLI installed
- ESP32 development board

### Installation

1. **Clone the repository:**

    ```sh
    https://github.com/MoonLighTingPY/esp-dashboard.git
    cd esp-dashbord
    ```

2. **Install Node.js dependencies:**

    ```sh
    npm install
    ```
    
3. **Build the static files and move them to ESP32 FS folder:**

    ```sh
    npm run build
    ```
You will recieve something like this:
    

>  dist/index.html.gz                        1.35 kB
> 	dist/assets/favicon-CeFdrAAK.ico        239.68 kB
> 	dist/assets/index-CALTx-N1.css            1.99 kB │ gzip:   0.81 kB
> 	dist/assets/index-DpzU3tf1.js         1,142.46 kB │ gzip: 351.56 kB

Move .gz of theese files to the /data folder in your ESP32 project folder.
Ingore anything else, you only need the html, js and css.

4. **Build and upload the FS image to ESP32:**

    ```sh
    platformio.exe run --target uploadfs
    ```
    
5. **Upload the firmware to ESP32:**

    ```sh
    platformio.exe run --target upload
    ```
 

## Project Structure

```
-   **src/**: Contains the React application source code.
-   **dist/**
-   **images/**: Image assets.
```

## ESP32 Configuration

   The ESP32 configuration is managed through the  `platformio.ini`  file in your ESP32 Project folder:
   
     [env:esp32dev]
        platform = espressif32
        board = esp32dev
        framework = arduino
        monitor_speed = 115200
        lib_deps = 
          WiFiClientSecure
          Links2004/WebSockets@^2.3.6
          bblanchon/ArduinoJson@^6.18.5
          bogde/HX711@^0.7.4
          hoeken/PsychicHttp
          https://github.com/jkb-git/ESP32Servo.git
        board_build.filesystem = spiffs
        upload_port = COM3

## Libraries and Dependencies

### React and TypeScript

-   **React**:  @vitejs/plugin-react
-   **TypeScript**: TypeScript support with Vite

### ESP32

-   **WebSockets**:  Links2004/WebSockets
-   **ArduinoJson**:  bblanchon/ArduinoJson
-   **HX711**:  bogde/HX711
-   **PsychicHttp**:  hoeken/PsychicHttp
-   **ESP32Servo**:  jkb-git/ESP32Servo




