import { useState, useRef } from "react";
import { z } from "zod";

export const dataSchema = z.object({
  thrust: z.number(),
  torque: z.number(),
  voltage: z.number(),
  current: z.number(),
});

type DateSchema = z.infer<typeof dataSchema>;

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
  ],
};

export const useESP = () => {
  const [speed, setSpeed] = useState(800);
  const [duration, setDuration] = useState(5);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [espStateData, updateESPData] = useState(initData);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const dataQueue = useRef<any[]>([]);

  const handleStartReadings = async () => {
    if (!socket || !speed || !duration) return;

    const message = JSON.stringify({
      type: "start",
      duration: duration * 1000,
      speed,
    });
    socket.send(message);
    setIsTestRunning(true);
    setStartTime(new Date().getTime());

    // Reset state after the duration has passed
    setTimeout(() => {
      setSpeed(() => 800);
      setDuration(() => 0);
      setIsTestRunning(() => false);
      setStartTime(null);
    }, duration * 1000); // Convert duration to milliseconds
  };

  const handleStopReadings = () => {
    if (!socket) return;

    const message = JSON.stringify({ type: "stop" });
    socket.send(message);
    setIsTestRunning(false);
    setStartTime(null);
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
    speed,
    setSpeed,
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
    dataQueue,
    handleStartReadings,

    handleStopReadings,
    handleClearGraph,
  };
};
