//@ts-nocheck

export function processSDP(sdpString: string) {
  let { head, transceivers } = parseSDP(sdpString.replace(/\r\n/g, '\n'));

  transceivers = transceivers.map(e => ({
    ...e,
    ...(e.parserHead.type == 'video'
      ? {
          parserHead: {
            ...e.parserHead,
            codeCodes: e.parserHead.codeCodes.filter(e =>
              [96, 97].includes(parseInt(e)),
            ),
          },
          codecs: e.codecs
            .filter(e => [96, 97].includes(parseInt(e.parse.id)))
            .map(({ parse, text }) => ({
              parse: {
                ...parse,
                ...(parse.codec == 'H264' ? { codec: 'VP8' } : {}),
              },
              text,
            })),
        }
      : {}),
  }));

  return buildSDP({ head, transceivers }).replace(/\n/g, '\r\n');
}

function parseSDP(sdp) {
  let { head, transceivers } = splitTransceiver(sdp);

  return {
    head,
    transceivers: transceivers
      .map(e => splitCodecs(e))
      .map(e => ({
        ...e,
        codecs: e.codecs.map(f => ({
          text: f,
          parse: parseCodec(f),
        })),
      })),
  };
}

function buildSDP(sdpObj) {
  return [
    sdpObj.head,
    ...sdpObj.transceivers.map(
      ({
        codecs,
        head,
        parserHead: { type, num, connectTypes, codeCodes, rest },
        tail,
      }) =>
        [
          [
            ['m=' + type, num, connectTypes, codeCodes.join(' ')].join(' '),
            rest,
          ].join('\n'),
          ...codecs.map(
            ({
              parse: {
                id = '',
                codec = '',
                clockRate = '',
                channel = '',
                rest = '',
              } = {},
            }) =>
              [
                ['a=rtpmap:' + id, codec + '/' + clockRate + channel].join(' '),
                rest,
              ].join('\n'),
          ),
          tail,
        ].join('\n'),
    ),
  ]
    .join('\n')
    .replace(/\n\n/g, '\n');
}

function splitTransceiver(sdp) {
  let [head, ...preTransceiver] = sdp.split(/m=(video|audio)( [0-9]+ )/g);

  let transceivers = new Array((preTransceiver.length / 3) | 0)
    .fill('')
    .map(
      (e, i) =>
        `m=${preTransceiver[i * 3]}${preTransceiver[i * 3 + 1]}${
          preTransceiver[i * 3 + 2]
        }`,
    );

  return {
    head,
    transceivers,
  };
}

function splitCodecs(transceiver) {
  let [head, ...tailAndCodecs] = transceiver.split(/(a=rtpmap:[0-9]+ )/);

  let parserHead = parseTransceiverHead(head);

  let [rawCodecs, ...tail] = tailAndCodecs
    .join('')
    .split(/(a=ssrc-group:[A-Za-z]+ [0-9]+ [0-9]+|a=ssrc:[0-9]+)/g);

  if (parserHead.type == 'video') {
    let preCodecs = rawCodecs.split(/( apt=[0-9]+)/g);

    let codecs = new Array((preCodecs.length / 2) | 0)
      .fill('')
      .map((e, i) => `${preCodecs[i * 2]}${preCodecs[i * 2 + 1]}`)
      .map(e => e.replace(/^\n/, '').replace(/\n\n/g, '\n'));

    return {
      head: head.replace(/^\n/, '').replace(/\n\n/g, '\n'),
      parserHead,
      codecs: codecs,
      tail: tail
        .join('')
        .replace(/^\n/, '')
        .replace(/\n\n/g, '\n'),
    };
  } else {
    let [, ...preCodecs] = rawCodecs.split(/(a=rtpmap:[0-9]+ )/g);

    let codecs = new Array((preCodecs.length / 2) | 0)
      .fill('')
      .map((e, i) => `${preCodecs[i * 2]}${preCodecs[i * 2 + 1]}`);

    return {
      head: head.replace(/^\n/, '').replace(/\n\n/g, '\n'),
      parserHead,
      codecs: codecs,
      tail: tail
        .join('')
        .replace(/^\n/, '')
        .replace(/\n\n/g, '\n'),
    };
  }
}

function parseTransceiverHead(headString) {
  let [
    ,
    type = '',
    num = '',
    connectTypes = '',
    codeCodes = '',
    ,
    ...rest
  ] = headString.split(/m=(audio|video) ([0-9]+) ([A-Z\/]+)(( [0-9]+)+)\n/);

  return {
    type,
    num,
    connectTypes,
    codeCodes: codeCodes.trim().split(' '),
    rest: rest.join(''),
  };
}

function parseCodec(codeStr) {
  let [, id, codec, clockRate = '', channel = '', , ...rest] = codeStr.split(
    /^a=rtpmap:([0-9]+) ([a-zA-Z0-9\-]+)\/([0-9]+)(\/([0-9]+))?/,
  );

  return {
    id,
    codec,
    clockRate,
    channel,
    rest: rest.join('').replace(/^\n/, ''),
  };
}
