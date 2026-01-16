#!/bin/bash
# URL="https://work.moecapital.com/api/telegram/webhook"
URL="https://work.moecapital.com/api/telegram/webhook"

echo "Testing Content Refinery pipeline..."
echo "Target: $URL"

echo "Registering Admin User (Mock)..."
curl -s -X POST -H "Content-Type: application/json" -d '{"chatId": 123456, "username": "testadmin", "firstName": "Test"}' "https://work.moecapital.com/api/admin/register"
echo ""

# Send 12 messages to trigger batch processing (Batch size is 10)
for i in {1..12}
do
   PAYLOAD=$(cat <<EOF
{
    "update_id": $((1000 + i)),
    "channel_post": {
        "message_id": $((2000 + i)),
        "chat": {
            "id": -100123456789,
            "title": "Test Financial Channel",
            "type": "channel"
        },
        "date": $(date +%s),
        "text": "BREAKING: Tesla ($TSLA) reports record earnings for Q4. Revenue up 20%. #earnings #tech (Message $i)"
    }
}
EOF
)

   echo "Sending message $i..."
   curl -s -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$URL"
   echo ""
done

echo "Messages sent. Check logs for 'Processing batch' and 'Intel'."
echo "run: npx wrangler tail"
