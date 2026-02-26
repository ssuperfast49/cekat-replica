const fs = require('fs');
const data = JSON.parse(fs.readFileSync('n8n-workflow/livechat_simplified.json'));

const ifNode = {
    "parameters": {
        "conditions": {
            "options": {
                "caseSensitive": true,
                "leftValue": "",
                "typeValidation": "strict",
                "version": 2
            },
            "conditions": [
                {
                    "id": "assigned-check",
                    "leftValue": "={{ $('Verify HMAC1').first().json.data.is_assigned }}",
                    "rightValue": true,
                    "operator": {
                        "type": "boolean",
                        "operation": "true",
                        "singleValue": true
                    }
                }
            ],
            "combinator": "and"
        },
        "options": {}
    },
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [
        2350,
        -1100
    ],
    "id": "if-assigned-node-id",
    "name": "If Assigned to Human"
};

data.nodes.push(ifNode);

// Change connections: Verify HMAC1 -> If Assigned to Human
data.connections["Verify HMAC1"] = {
    "main": [
        [
            {
                "node": "If Assigned to Human",
                "type": "main",
                "index": 0
            }
        ]
    ]
};

// If Assigned to Human (true) -> nothing (stops)
// If Assigned to Human (false) -> Message a model
data.connections["If Assigned to Human"] = {
    "main": [
        [], // True = assigned, do nothing
        [   // False = unassigned, go to AI
            {
                "node": "Message a model",
                "type": "main",
                "index": 0
            }
        ]
    ]
};

fs.writeFileSync('n8n-workflow/livechat_simplified.json', JSON.stringify(data, null, 2));
console.log("Updated livechat_simplified.json");
