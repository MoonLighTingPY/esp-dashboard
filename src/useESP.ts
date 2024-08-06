import { useState, useRef } from "react";
import { z } from "zod";

export const dataSchema = z.object({
  thrust: z.number(),
  torque: z.number(),
  voltage: z.number(),
  current: z.number(),
});

type DateSchema = number;

const initData = {
  labels: [] as string[],
  datasets: [
    {
      label: "Thrust",
      data: [] as DateSchema[],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 0.2)",
    },
    {
      label: "Torque",
      data: [] as DateSchema[],
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 0.2)",
    },
    {
      label: "Voltage",
      data: [] as DateSchema[],
      borderColor: "rgba(75, 192, 192, 1)",
      backgroundColor: "rgba(75, 192, 192, 0.2)",
    },
    {
      label: "Current",
      data: [] as DateSchema[],
      borderColor: "rgb(58, 201, 68)",
      backgroundColor: "rgba(77, 192, 75, 0.2)",
    },
    {
      label: "Speed",
      data: [] as number[], // Add speed dataset
      borderColor: "rgba(255, 206, 86, 1)",
      backgroundColor: "rgba(255, 206, 86, 0.2)",
    },
  ],
};

export const useESP = () => {
  const [startSpeed, setStartSpeed] = useState(800);
  const [endSpeed, setEndSpeed] = useState(1000);
  const [duration, setDuration] = useState(5);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [espStateData, updateESPData] = useState(initData);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [speed, setSpeed] = useState(0); // Declare speed state

  const dataQueue = useRef<any[]>([]);
  const speedBuffer = useRef<{ timestamp: number; speed: number }[]>([]);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null); // Store interval ID

  const handleStartReadings = async () => {
    if (!socket || !startSpeed || !endSpeed || !duration) return;

    const durationMs = duration * 1000; // Duration in milliseconds
    const startTime = new Date().getTime(); // Start time

    const message = JSON.stringify({
      type: "start",
      duration: durationMs,
      speed: startSpeed,
    });
    socket.send(message);
    setIsTestRunning(true);
    setStartTime(startTime);

    // Clear any existing speed data
    speedBuffer.current = [];

    const updateSpeed = () => {
      const now = new Date().getTime();
      const elapsed = now - startTime;
    
      if (elapsed >= durationMs || isTestRunning === true) {
        setSpeed(endSpeed); // Ensure final speed is exactly endSpeed
        const finalMessage = JSON.stringify({
          type: "speedUpdate",
          speed: endSpeed,
        });
        socket.send(finalMessage);
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
        }
        return;
      }
    
      // Calculate the current speed based on elapsed time
      let progress;
      progress = elapsed / durationMs;     
      const currentSpeed = startSpeed + (endSpeed - startSpeed) * progress;
      setSpeed(currentSpeed);
    
      // Send the current speed to the server
      const speedMessage = JSON.stringify({
        type: "speedUpdate",
        speed: currentSpeed,
      });
      socket.send(speedMessage);
    }
    
    // Update speed every 100ms
    intervalIdRef.current = setInterval(updateSpeed, 100); // Store interval ID
  };

  const handleStopReadings = () => {
    if (!socket) return;

    const message = JSON.stringify({ type: "stop" });
    socket.send(message);
    setIsTestRunning(false);
    setStartTime(null);
    setSpeed(0);

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current); // Clear the interval
      intervalIdRef.current = null;
    }
  };

  const handleClearGraph = () => {
    updateESPData({
      labels: [],
      datasets: espStateData.datasets.map((dataset) => ({
        ...dataset,
        data: [],
      })),
    });
  };

  return {
    startSpeed,
    setStartSpeed,
    endSpeed,
    setEndSpeed,
    duration,
    setDuration,
    startTime,
    setStartTime,
    data: espStateData,
    setData: updateESPData,
    isTestRunning,
    setIsTestRunning,
    socket,
    setSocket,
    speed, // Return speed state
    dataQueue,
    handleStartReadings,
    handleStopReadings,
    handleClearGraph,
  };
};
