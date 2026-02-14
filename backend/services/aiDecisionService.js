

class AIDecisionService {
    constructor() {
        this.providers = {
            openai: {
                url: 'https://api.openai.com/v1/chat/completions',
                headers: (apiKey) => ({
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }),
                formatBody: (model, systemPrompt, userPrompt) => ({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    response_format: { type: "json_object" }
                }),
                parseResponse: (data) => {
                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        throw new Error('Invalid OpenAI response structure');
                    }
                    return JSON.parse(data.choices[0].message.content);
                }
            },
            anthropic: {
                url: 'https://api.anthropic.com/v1/messages',
                headers: (apiKey) => ({
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                }),
                formatBody: (model, systemPrompt, userPrompt) => ({
                    model: model,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: 1024,
                    temperature: 0.7
                }),
                parseResponse: (data) => {
                    if (!data.content || !data.content[0] || !data.content[0].text) {
                        throw new Error('Invalid Anthropic response structure');
                    }
                    return JSON.parse(data.content[0].text);
                }
            },
            gemini: {
                url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                headers: () => ({
                    'Content-Type': 'application/json'
                }), // API key is query param for Gemini usually, but we'll check standard pattern
                formatBody: (model, systemPrompt, userPrompt) => ({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\nGame Situation:\n${userPrompt}` }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        responseMimeType: "application/json"
                    }
                }),
                parseResponse: (data) => {
                    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                        throw new Error('Invalid Gemini response structure');
                    }
                    return JSON.parse(data.candidates[0].content.parts[0].text);
                }
            }
        };
    }

    detectProvider(modelName) {
        const lowerName = modelName.toLowerCase();
        if (lowerName.includes('gpt') || lowerName.includes('o1')) return 'openai';
        if (lowerName.includes('claude')) return 'anthropic';
        if (lowerName.includes('gemini')) return 'gemini';
        return null;
    }

    generateSystemPrompt() {
        return `You are an advanced AI agent playing a high-stakes simplified Monopoly-style game called "Tycoon". 
Your goal is to bankrupt other players and become the wealthiest tycoon.

GAME RULES:
1. Board has 40 positions. Properties have prices, rents, and color groups.
2. You can buy unowned properties if you have enough balance.
3. You MUST pay rent if you land on an opponent's property.
4. You can build houses/hotels on properties you own (must have complete color group).
5. You can mortgage/unmortgage properties to manage liquidity.
6. You can propose trades with other players.

DECISION STRUCTURE (JSON Example):
{
  "type": "buy_property", // Action type
  "data": { "property_id": 101 }, // Action data (e.g. property_id)
  "reasoning": "This property completes my blue color group...", 
  "confidence": 0.95 // 0.0 to 1.0
}

POSSIBLE ACTIONS:
- "buy_property": { property_id } -> Buy current property if unowned.
- "pay_rent": { property_id } -> Mandatory if landed on owned property.
- "build_house": { property_id } -> Build house on owned property.
- "build_hotel": { property_id } -> Build hotel (requires 4 houses).
- "mortgage": { property_id } -> Mortgage property for cash.
- "unmortgage": { property_id } -> Pay back mortgage.
- "end_turn": {} -> End your turn (if no other mandatory/strategic actions).
- "propose_trade": { ... } -> (Advanced) Propose a trade.

CRITICAL INSTRUCTIONS:
- You must output VALID JSON only. No markdown, no conversational text.
- Analyze the "Game State" provided carefully.
- Check valid moves: Do not try to buy owned properties (unless paying rent) or build without funds.
- If you have low cash, prioritize "end_turn" or "mortgage" to survive.
- If you have high cash, be aggressive ("buy_property", "build_house").
`;
    }

    formatGameState(gameState, agent) {
        // Simplify game state for token efficiency
        const { current_player, players, properties, board_position, dice_roll } = gameState;

        // Filter relevant properties (owned by player, or current position)
        const currentProp = properties.find(p => p.position === board_position);
        const myProps = properties.filter(p => p.owner_id === agent.id);
        const opponentProps = properties.filter(p => p.owner_id && p.owner_id !== agent.id);

        return JSON.stringify({
            my_agent: {
                id: agent.id,
                name: agent.name,
                balance: players.find(p => p.id === agent.id).balance,
                position: board_position,
                strategy: agent.strategy,
                risk_profile: agent.risk_profile,
                owned_properties: myProps.map(p => ({
                    id: p.id,
                    name: p.name,
                    color: p.color,
                    houses: p.houses,
                    is_mortgaged: p.is_mortgaged
                }))
            },
            current_situation: {
                dice_roll: dice_roll,
                landed_on: currentProp ? {
                    id: currentProp.id,
                    name: currentProp.name,
                    price: currentProp.price,
                    owner_id: currentProp.owner_id,
                    base_rent: currentProp.base_rent,
                    is_own: currentProp.owner_id === agent.id
                } : "Empty Space"
            },
            opponents: players.filter(p => p.id !== agent.id).map(p => ({
                id: p.id,
                name: p.name, // Use name instead of agent_name for simplicity
                balance: p.balance,
                prop_count: properties.filter(prop => prop.owner_id === p.id).length
            }))
        }, null, 2);
    }

    async getDecision(gameState, agent) {
        if (!agent.config || !agent.config.api_key || !agent.config.ai_model) {
            throw new Error('Missing API configuration');
        }

        const providerName = this.detectProvider(agent.config.ai_model);
        if (!providerName) {
            throw new Error(`Unsupported model: ${agent.config.ai_model}`);
        }

        const provider = this.providers[providerName];
        const systemPrompt = this.generateSystemPrompt();
        const userPrompt = this.formatGameState(gameState, agent);
        const body = provider.formatBody(agent.config.ai_model, systemPrompt, userPrompt);

        let url = provider.url;
        let headers = provider.headers(agent.config.api_key);

        // Special handling for Gemini URL which needs API key in query param usually
        if (providerName === 'gemini') {
            url = `${provider.url(agent.config.ai_model)}?key=${agent.config.api_key}`;
        }

        try {
            console.log(`🤖 Calling AI (${agent.config.ai_model}) for ${agent.name}...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const decision = provider.parseResponse(data);

            // Basic validation
            if (!decision.type) {
                throw new Error('AI response missing decision type');
            }

            console.log(`✅ AI Decision for ${agent.name}:`, decision.type);
            return decision;

        } catch (error) {
            console.error(`❌ AI Decision Failed:`, error.message);
            throw error; // Propagate to fallback
        }
    }
}

export default new AIDecisionService();
