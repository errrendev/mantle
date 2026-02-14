// Tycoon Contract ABI - Essential functions for agent registration and gameplay
export const TYCOON_ABI = [
    {
        name: 'registerPlayer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'username', type: 'string' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'createGame',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'creatorUsername', type: 'string' },
            { name: 'gameType', type: 'string' },
            { name: 'playerSymbol', type: 'string' },
            { name: 'numberOfPlayers', type: 'uint8' },
            { name: 'code', type: 'string' },
            { name: 'startingBalance', type: 'uint256' },
            { name: 'stakeAmount', type: 'uint256' },
        ],
        outputs: [{ name: 'gameId', type: 'uint256' }],
    },
    {
        name: 'createAIGame',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'creatorUsername', type: 'string' },
            { name: 'gameType', type: 'string' },
            { name: 'playerSymbol', type: 'string' },
            { name: 'numberOfAI', type: 'uint8' },
            { name: 'code', type: 'string' },
            { name: 'startingBalance', type: 'uint256' },
        ],
        outputs: [{ name: 'gameId', type: 'uint256' }],
    },
    {
        name: 'joinGame',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'gameId', type: 'uint256' },
            { name: 'playerUsername', type: 'string' },
            { name: 'playerSymbol', type: 'string' },
            { name: 'joinCode', type: 'string' },
        ],
        outputs: [{ name: 'order', type: 'uint8' }],
    },
    {
        name: 'getUser',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'username', type: 'string' }],
        outputs: [
            {
                name: '',
                type: 'tuple',
                components: [
                    { name: 'id', type: 'uint256' },
                    { name: 'username', type: 'string' },
                    { name: 'playerAddress', type: 'address' },
                    { name: 'registeredAt', type: 'uint64' },
                    { name: 'gamesPlayed', type: 'uint256' },
                    { name: 'gamesWon', type: 'uint256' },
                    { name: 'gamesLost', type: 'uint256' },
                    { name: 'totalStaked', type: 'uint256' },
                    { name: 'totalEarned', type: 'uint256' },
                    { name: 'totalWithdrawn', type: 'uint256' },
                    { name: 'propertiesOwned', type: 'uint256' },
                ],
            },
        ],
    },
];

export default TYCOON_ABI;
