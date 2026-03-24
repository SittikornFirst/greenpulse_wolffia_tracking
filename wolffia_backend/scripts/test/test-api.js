async function testApi() {
  try {
    // 1. Authenticate to get a token
    const authRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@greenpulse.com",
        password: "admin123",
      }),
    });

    if (!authRes.ok) throw new Error("Login failed");
    const authData = await authRes.json();
    const token = authData.token;

    // 2. Add device
    const res = await fetch("http://localhost:3000/api/devices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Test Setup Device API FN",
        location: "Test Loc FN",
      }),
    });

    const data = await res.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Error creating device:", err.message);
  }
}

testApi();
