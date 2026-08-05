import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up
    { duration: '1m', target: 100 }, // sustained load
    { duration: '30s', target: 0 },  // ramp down
  ],
};

export default function () {
  const res = http.get('https://yourcaptions.com');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
