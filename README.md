# TwinTrap
This project is a amalgamation of cybersecurity and IoT, where detection of fake Wi-Fi networks is done.

This project was an idea which came to me from a LinkedIn post, which intrigued me about the uses of IoT in Cybersecurity in a compact device. With the help of Spacehuhn docs, I and some of my friends bought an ESP8266 board. This project is a collective doing of me and another friend of mine, @Shruthipoosa. 

This project aims at detection and recording of fake Wi-Fi network in a network where our ESP8266 is actually connected. 

Following are the steps to be taken care of:
1. In the Arduino code, explicitly define the Wi-Fi name and the password through which the system can connect to the network. I prefer usung my own mobile hotspot for thus purpose. Don't specify any BSSID, but do specify your system's ip4v address. If it keeps changing, make it static or keep it changing in the Arduino code. This is very crucial for the WebSocket conection to send the data to the frontend of the Application.

2. Once that is done, make sure the frontend and backend are running. Also make sure that the system is connected to the Wi-Fi you have specified in the Arduino code.

3. Voila! It is done!!! 
