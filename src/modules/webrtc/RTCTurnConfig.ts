



export async function getICEServerConfig() {

  return Promise
    .race([
      fetch(
        "https://call-config.beowulfchain.com/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          "requestID": Math.random().toString(),
          "callType": "a"
        }),

      })
        .then(e => e.json())
        .then(({ data }) => {
          return data.map((iceServer: any) => {
            return {
              ...iceServer,
              credential: iceServer.password,
            };
          });
        }),
      new Promise((rs, rj) => setTimeout(rj, 5000, "TurnConfig Time out"))
    ])
    .catch(() => {
      return [
        {
          urls: ['stun:34.92.44.253:3478'],
        },
        {
          urls: ['stun:35.247.153.249:3478'],
        },
        {
          urls: ['turn:34.92.44.253:3478'],
          username: 'username',
          credential: 'password',
        },
        {
          urls: ['turn:35.247.153.249:3478'],
          username: 'username',
          credential: 'password',
        },
      ];
    })
    .then(iceServers => {
      return {
        sdpSemantics: 'unified-plan',
        iceServers,
      };
    });
}