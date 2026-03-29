@echo off
cd /d "c:\Users\Asus\OneDrive\Desktop\Bus Monitoring System\frontend"
call npm install react-router-dom axios socket.io-client react-hot-toast lucide-react
call npm install -D tailwindcss@3 postcss autoprefixer
call npx tailwindcss init -p
echo DONE
