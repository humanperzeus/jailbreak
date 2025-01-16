import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { IAgentRuntime, elizaLogger } from "@elizaos/core";

export interface KeypairResult {
    keypair?: Keypair;
    publicKey?: PublicKey;
}

export async function getWalletKey(
    runtime: IAgentRuntime,
    requirePrivateKey: boolean = true
): Promise<KeypairResult> {
    if (requirePrivateKey) {
        const privateKeyString =
            runtime.getSetting("SOLANA_PRIVATE_KEY") ??
            runtime.getSetting("WALLET_PRIVATE_KEY");

        if (!privateKeyString) {
            throw new Error("Private key not found in settings");
        }

        try {
            // First try base58
            const secretKey = bs58.decode(privateKeyString);
            return { keypair: Keypair.fromSecretKey(secretKey) };
        } catch (e) {
            elizaLogger.log("Error decoding base58 private key:", e);
            try {
                // Then try base64
                elizaLogger.log("Try decoding base64 instead");
                const secretKey = Uint8Array.from(
                    Buffer.from(privateKeyString, "base64")
                );
                return { keypair: Keypair.fromSecretKey(secretKey) };
            } catch (e2) {
                elizaLogger.error("Error decoding private key: ", e2);
                throw new Error("Invalid private key format");
            }
        }
    } else {
        const publicKeyString =
            runtime.getSetting("SOLANA_PUBLIC_KEY") ??
            runtime.getSetting("WALLET_PUBLIC_KEY");

        if (!publicKeyString) {
            throw new Error("Public key not found in settings");
        }

        return { publicKey: new PublicKey(publicKeyString) };
    }
}