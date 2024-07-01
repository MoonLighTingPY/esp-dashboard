import React, { useState, useEffect, useRef } from 'react';
import { Button, Container, TextField, Box } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const useESP = () => {}

const App: React.FC = () => {
  const [speed, setSpeed] = useState('');
  const [duration, setDuration] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [data, setData] = useState({
    labels: [] as string[],
    datasets: [
      {
        label: 'Thrust',
        data: [] as number[],
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      },
      {
        label: 'Torque',
        data: [] as number[],
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
      },
      {
        label: 'Throttle',
        data: [] as number[],
        borderColor: 'rgba(255, 206, 86, 1)',
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
      },
      {
        label: 'Voltage',
        data: [] as number[],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
    ],
  });
  const [isTestButtonPressed, setIsTestButtonPressed] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const dataQueue = useRef<any[]>([]);

  useEffect(() => {
    const ws = new WebSocket('ws://172.20.10.2:8080');
    setSocket(ws);

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      dataQueue.current.push(newData);
    };
  }, [socket]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (dataQueue.current.length > 0) {
        const batchData = dataQueue.current;
        dataQueue.current = [];

        const averages = batchData.reduce((acc, curr) => {
          Object.keys(curr).forEach((key) => {
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(curr[key]);
          });
          return acc;
        }, {} as Record<string, number[]>);

        Object.keys(averages).forEach((key) => {
          averages[key] = averages[key].reduce((a: number, b: number) => a + b, 0) / averages[key].length;
        });

        setData((prevData) => {
          const currentTime = new Date();
          const elapsedTime = Math.floor((currentTime.getTime() - (startTime || currentTime.getTime())) / 1000);
          const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
          const seconds = String(elapsedTime % 60).padStart(2, '0');
          const formattedTime = `${minutes}:${seconds}`;

          return {
            ...prevData,
            labels: [...prevData.labels, formattedTime],
            datasets: prevData.datasets.map((dataset, index) => ({
              ...dataset,
              data: [...dataset.data, averages[Object.keys(averages)[index]]],
            })),
          };
        });
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [startTime]);

  const handleStartReadings = () => {
    if (!socket || !speed || !duration) return;

    const message = JSON.stringify({ type: 'start', duration, speed });
    socket.send(message);
    setIsTestButtonPressed(true);
    setStartTime(new Date().getTime());

    // Reset state after the duration has passed
    setTimeout(() => {
      setSpeed('');
      setDuration('');
      setIsTestButtonPressed(false);
      setStartTime(null);
    }, parseInt(duration) * 1000); // Convert duration to milliseconds
  };

  const handleStopReadings = () => {
    if (!socket) return;

    const message = JSON.stringify({ type: 'stop' });
    socket.send(message);
    setIsTestButtonPressed(false);
    setStartTime(null);
  };

  const handleClearGraph = () => {
    setData({
      labels: [],
      datasets: data.datasets.map((dataset) => ({
        ...dataset,
        data: [],
      })),
    });
  };

  return (
    <Container>
      <Box my={4}>
        <TextField
          label="Speed"
          variant="outlined"
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Duration"
          variant="outlined"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          fullWidth
          margin="normal"
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleStartReadings}
          disabled={!speed || !duration}
          fullWidth
          sx={{ mt: 2, mr: 1, bgcolor: isTestButtonPressed ? 'success.dark' : 'primary.main' }}
        >
          {isTestButtonPressed ? 'Test (Active)' : 'Test'}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleStopReadings}
          fullWidth
          sx={{ mt: 2, mr: 1 }}
        >
          Stop
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleClearGraph}
          fullWidth
          sx={{ mt: 2 }}
        >
          Clear Graph
        </Button>
      </Box>
      <Box my={4}>
        <Line data={data} />
      </Box>
    </Container>
  );
};

export default App;
