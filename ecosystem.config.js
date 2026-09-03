module.exports = {
  apps: [
    {
      name: "aakash-hrms",
      script: "app.js",
      cwd: "/home/jelastic/ROOT",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
