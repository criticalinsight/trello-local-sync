#!/bin/bash
# URL="https://work.moecapital.com/api/telegram/webhook"
URL="https://work.moecapital.com/api/telegram/webhook"

echo "Testing Content Refinery pipeline..."
echo "Target: $URL"

echo "Registering Admin User (Mock)..."
curl -s -X POST -H "Content-Type: application/json" -d '{"chatId": 123456, "username": "testadmin", "firstName": "Test"}' "https://work.moecapital.com/api/admin/register"
echo ""

echo "Test: Channel-Specific Routing..."
CHANNELS=("Americamoe" "MoneyAcademyKE" "GoTryThis" "MoeCrypto")
TEXTS=("Safaricom dividend announcement #KE" "Tesla earnings beat #US" "New open source tool released #AI" "Bitcoin hits new ATH #Crypto")

for i in "${!CHANNELS[@]}"
do
    CHANNEL="${CHANNELS[$i]}"
    TEXT="${TEXTS[$i]}"
    echo "Sending post from $CHANNEL..."
    curl -s -X POST -H "Content-Type: application/json" -d "{
        \"update_id\": $((3000 + i)),
        \"channel_post\": {
            \"message_id\": $((4000 + i)),
            \"chat\": { \"id\": $((100 + i)), \"title\": \"$CHANNEL\", \"type\": \"channel\" },
            \"date\": $(date +%s),
            \"text\": \"$TEXT. High relevance signal for institutional alpha. (Channel Test)\"
        }
    }" "$URL"
    echo ""
done

curl -s -X POST "https://work.moecapital.com/api/refinery/process"

echo "Verification Complete. Run logs check:"
echo "1. Boards: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT id, title FROM boards\"}' https://work.moecapital.com/api/sql"
echo "2. Cards Routing: curl -s -X POST -H 'Content-Type: application/json' -d '{\"sql\": \"SELECT title, board_id FROM cards WHERE title LIKE \u0027%Intel%\u0027\"}' https://work.moecapital.com/api/sql"
