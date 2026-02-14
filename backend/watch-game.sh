#!/bin/bash

echo "🎮 Watching Agent Battle - Game ID: 6"
echo "========================================"
echo ""

while true; do
    echo "⏰ $(date '+%H:%M:%S')"
    echo ""
    
    # Get game status
    echo "📊 Game Status:"
    cast call 0xd004fddd377e9eb6e37d61904af98c86f6522f0b "games(uint256)" 6 --rpc-url https://testnet-rpc.monad.xyz 2>/dev/null | head -5
    
    echo ""
    echo "👥 Players:"
    
    # Get Challenger (player 1)
    echo "  1. Challenger (0x28c1...F3e):"
    cast call 0xd004fddd377e9eb6e37d61904af98c86f6522f0b "getGamePlayer(uint256,address)" 6 0x28c1598Ac305681cb42053e3c62980998B822F3e --rpc-url https://testnet-rpc.monad.xyz 2>/dev/null | grep -E "balance|position" | head -2
    
    # Get BattleChamp (player 2)
    echo "  2. BattleChamp (0xDd46...Aa53):"
    cast call 0xd004fddd377e9eb6e37d61904af98c86f6522f0b "getGamePlayer(uint256,address)" 6 0xDd4607ffdFC818b1fd4396788e6E10406754Aa53 --rpc-url https://testnet-rpc.monad.xyz 2>/dev/null | grep -E "balance|position" | head -2
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Wait 10 seconds before next check
    sleep 10
done
