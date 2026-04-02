
const axios = require('axios');

async function testApi() {
  const teamId = 'a98bb035-7f5b-45e2-ac22-6799014cc0c0'; // ID from my previous thought if I could see it, let me get it from the script output.
  // Actually, I'll just use the email login to get a token and then call the api.
  
  try {
    const loginRes = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'player@test.com',
      password: 'Password@1234'
    });
    const token = loginRes.data.accessToken || loginRes.data.data.accessToken;
    console.log('Login success');

    const userRes = await axios.get('http://localhost:3000/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const player = userRes.data.data?.playerProfile || userRes.data.data?.player;
    console.log('Player Team ID:', player?.teamId);

    if (player?.teamId) {
      const matchRes = await axios.get(`http://localhost:3000/api/v1/matches?teamId=${player.teamId}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Matches Response:', JSON.stringify(matchRes.data, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testApi();
