# TwinTrap
This project is a amalgamation of cybersecurity and IoT, where detection of fake Wi-Fi networks is done.

This project was an idea which came to me from a LinkedIn post, which intrigued me about the uses of IoT in Cybersecurity in a compact device. With the inspiration from Spacehuhn docs, I and some of my friends bought an ESP8266 board. This project is a collective doing of me and another friend of mine, @Shruthipoosa. 

This project aims at detection and recording of fake Wi-Fi network in a network where our ESP8266 is actually connected. 

Following are the steps to be taken care of:

1. Please go to the location of the root project and create a Python Virtual Environment with the following commands:
   *python -m venv venv*
   *.venv\Scripts\activate*

2. Once that is done, install the requirements.txt.

3. Make sure that the code in the Arduino IDE is compiled and uploaded before the main project is run.
  
4. In the Arduino code, explicitly define the Wi-Fi name and the password through which the system can connect to the network. I prefer usung my own mobile hotspot for thus purpose. Don't specify any BSSID, but do specify your system's ip4v address. Remember, this changes along with the WiFi your system is connected to. Let the system be constantly connected to one single WiFi network, preferably your mobile hotspot.

5. Once that is done, make sure the frontend and backend are running. Also make sure that the system is connected to the Wi-Fi you have specified in the Arduino code.

6. Voila! It is done!!!

<img width="1919" height="875" alt="image" src="https://github.com/user-attachments/assets/39eed7ea-b838-47d9-a695-15d81c3b7da0" />
<img width="1907" height="877" alt="image" src="https://github.com/user-attachments/assets/b4e33698-f367-406a-8c96-a820fdda7353" />
<img width="1915" height="874" alt="image" src="https://github.com/user-attachments/assets/0c7ad89c-bd52-4c03-8cd1-585924b3dd4b" />
<img width="1906" height="873" alt="image" src="https://github.com/user-attachments/assets/b56333c7-c548-4056-8b71-fe56518986a4" />




