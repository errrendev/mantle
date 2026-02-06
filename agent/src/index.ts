import { createErenAgent } from "./config/eren.js";
import { HumanMessage } from "@langchain/core/messages";

async function main() {
  try {
    const eren = createErenAgent();

    console.log("🤖 Eren Agent Initialized with Blockchain Capabilities\n");

    // Example 1: Get ETH balance
    console.log("📝 Example 1: Check ETH Balance");
    const response1 = await eren.invoke({
      messages: [
        new HumanMessage("What is the ETH balance of 0xa32e1bd66b0824D63Bb3fEe4855750FCAb39e4aD?")
      ],
    });
    const answer1 = response1.messages[response1.messages.length - 1];
    console.log("Eren:", answer1.content);
    console.log("\n" + "=".repeat(80) + "\n");

    // Example 2: Get current block number
    console.log("📝 Example 2: Get Block Number");
    const response2 = await eren.invoke({
      messages: [
        new HumanMessage("What is the current block number?")
      ],
    });
    const answer2 = response2.messages[response2.messages.length - 1];
    console.log("Eren:", answer2.content);
    console.log("\n" + "=".repeat(80) + "\n");

    // Example 3: Get gas price
    console.log("📝 Example 3: Get Gas Price");
    const response3 = await eren.invoke({
      messages: [
        new HumanMessage("What is the current gas price in Gwei?")
      ],
    });
    const answer3 = response3.messages[response3.messages.length - 1];
    console.log("Eren:", answer3.content);
    console.log("\n" + "=".repeat(80) + "\n");

    // Example 4: Complex query combining multiple tools
    console.log("📝 Example 4: Complex Query");
    const response4 = await eren.invoke({
      messages: [
        new HumanMessage(
          "Check the balance of 0xa32e1bd66b0824D63Bb3fEe4855750FCAb39e4aD, get the current gas price, and calculate what 100 * 50 + 25 equals"
        )
      ],
    });
    const answer4 = response4.messages[response4.messages.length - 1];
    console.log("Eren:", answer4.content);
    console.log("\n" + "=".repeat(80) + "\n");

    // Example 5: Get transaction details
    console.log("📝 Example 5: Get Transaction Details");
    const response5 = await eren.invoke({
      messages: [
        new HumanMessage(
          "Can you get details for transaction 0x1234... if it exists?"
        )
      ],
    });
    const answer5 = response5.messages[response5.messages.length - 1];
    console.log("Eren:", answer5.content);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main();