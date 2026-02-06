import { createErenAgent } from "./config/eren.js";
import { HumanMessage } from "@langchain/core/messages";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function chat() {
  const eren = createErenAgent();
  console.log("🤖 Eren Blockchain Agent - Interactive Mode");
  console.log("Type 'exit' to quit\n");

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        console.log("Goodbye! 👋");
        rl.close();
        return;
      }

      try {
        const response = await eren.invoke({
          messages: [new HumanMessage(input)],
        });

        const answer = response.messages[response.messages.length - 1];
        console.log(`\nEren: ${answer.content}\n`);
      } catch (error: any) {
        console.error("Error:", error.message);
      }

      askQuestion();
    });
  };

  askQuestion();
}

chat();