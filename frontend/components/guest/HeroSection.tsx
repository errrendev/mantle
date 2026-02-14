"use client";
import React, { useEffect, useState, useMemo } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Trophy, Play } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  useIsRegistered,
  useGetUsername,
  useRegisterPlayer,
  usePreviousGameCode,
  useGetGameByCode,
} from "@/context/ContractProvider";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";

const HeroSection: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();

  const [loading, setLoading] = useState(false);
  const [inputUsername, setInputUsername] = useState(""); // Only for new users
  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");

  const {
    write: registerPlayer,
    isPending: registerPending,
  } = useRegisterPlayer();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
    error: registeredError,
  } = useIsRegistered(address);

  const { data: fetchedUsername } = useGetUsername(address);

  const { data: gameCode } = usePreviousGameCode(address);

  const { data: contractGame } = useGetGameByCode(gameCode);

  const [user, setUser] = useState<UserType | null>(null);

  // Reset on disconnect
  useEffect(() => {
    if (!address) {
      setUser(null);
      setLocalRegistered(false);
      setLocalUsername("");
      setInputUsername("");
    }
  }, [address]);

  // Fetch backend user
  useEffect(() => {
    if (!address) return;

    let isActive = true;

    const fetchUser = async () => {
      try {
        const res = await apiClient.get<ApiResponse>(
          `/users/by-address/${address}?chain=Monad Testnet`
        );

        if (!isActive) return;

        if (res.success && res.data) {
          setUser(res.data as UserType);
        } else {
          setUser(null);
        }
      } catch (error: any) {
        if (!isActive) return;
        if (error?.response?.status === 404) {
          setUser(null);
        } else {
          console.error("Error fetching user:", error);
        }
      }
    };

    fetchUser();

    return () => {
      isActive = false;
    };
  }, [address]);

  // Derived registration status
  const registrationStatus = useMemo(() => {
    if (!address) return "disconnected";

    const hasBackend = !!user;
    const hasOnChain = !!isUserRegistered || localRegistered;

    if (hasBackend && hasOnChain) return "fully-registered";
    if (hasBackend && !hasOnChain) return "backend-only";
    return "none";
  }, [address, user, isUserRegistered, localRegistered]);

  // Best available username to display
  const displayUsername = useMemo(() => {
    return (
      user?.username ||
      localUsername ||
      fetchedUsername ||
      inputUsername ||
      "Player"
    );
  }, [user, localUsername, fetchedUsername, inputUsername]);

  // Handle registration (on-chain + backend if needed)
  const handleRegister = async () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    let finalUsername = inputUsername.trim();

    // If backend user exists but not on-chain → use backend username
    if (registrationStatus === "backend-only" && user?.username) {
      finalUsername = user.username.trim();
    }

    if (!finalUsername) {
      toast.warn("Please enter a username");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Processing registration...");

    try {
      // Register on-chain if not already
      if (!isUserRegistered && !localRegistered) {
        await registerPlayer(finalUsername);
      }

      // Create backend user if doesn't exist
      if (!user) {
        const res = await apiClient.post<ApiResponse>("/users", {
          username: finalUsername,
          address,
          chain: "Monad Testnet",
        });

        if (!res?.success) throw new Error("Failed to save user on backend");
        setUser({ username: finalUsername } as UserType); // optimistic
      }

      // Optimistic updates
      setLocalRegistered(true);
      setLocalUsername(finalUsername);

      toast.update(toastId, {
        render: "Welcome to Tycoon!",
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });

      router.refresh();
    } catch (err: any) {
      if (
        err?.code === 4001 ||
        err?.message?.includes("User rejected") ||
        err?.message?.includes("User denied")
      ) {
        toast.update(toastId, {
          render: "Transaction cancelled",
          type: "info",
          isLoading: false,
          autoClose: 3500,
        });
        return;
      }

      let message = "Registration failed. Try again.";
      if (err?.shortMessage) message = err.shortMessage;
      if (err?.message?.includes("insufficient funds")) message = "Insufficient gas funds";

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinuePrevious = () => {
    if (!gameCode) return;

    if (contractGame?.ai) {
      router.push(`/ai-play?gameCode=${gameCode}`);
    } else {
      router.push(`/game-play?gameCode=${gameCode}`);
    }
  };

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px]">
          Connecting to wallet...
        </p>
      </div>
    );
  }

  return (
    <section className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 bg-[#010F10]">
      <div className="w-full h-full overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      <div className="w-full h-auto absolute top-0 left-0 flex items-center justify-center">
        <h1 className="text-center uppercase font-kronaOne font-normal text-transparent big-hero-text w-full text-[40px] sm:text-[40px] md:text-[80px] lg:text-[135px] relative before:absolute before:content-[''] before:w-full before:h-full before:bg-gradient-to-b before:from-transparent lg:before:via-[#010F10]/80 before:to-[#010F10] before:top-0 before:left-0 before:z-1">
          TYCOON
        </h1>
      </div>

      <main className="w-full h-full absolute top-0 left-0 z-2 bg-transparent flex flex-col lg:justify-center items-center gap-1">
        {/* Welcome Message */}
        {(registrationStatus === "fully-registered" || registrationStatus === "backend-only") && !loading && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Welcome back, {displayUsername}!
            </p>
          </div>
        )}

        {loading && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Registering... Please wait.
            </p>
          </div>
        )}

        <div className="flex justify-center items-center md:gap-6 gap-3 mt-4 md:mt-6 lg:mt-4">
          <TypeAnimation
            sequence={[
              "AI vs AI Battles",
              1500,
              "Autonomous Agents",
              1500,
              "Agents Battle On-Chain",
              1800,
              "Witness AI Strategy",
              2000,
              "On-Chain Monopoly",
              1500,
            ]}
            wrapper="span"
            speed={40}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
        </div>

        <h1 className="block-text font-[900] font-orbitron lg:text-[116px] md:text-[98px] text-[54px] lg:leading-[120px] md:leading-[100px] leading-[60px] tracking-[-0.02em] uppercase text-[#17ffff] relative">
          TYCOON
          <span className="absolute top-0 left-[69%] text-[#0FF0FC] font-dmSans font-[700] md:text-[27px] text-[18px] rotate-12 animate-pulse">
            ?
          </span>
        </h1>

        <div className="w-full px-4 md:w-[70%] lg:w-[55%] text-center text-[#F0F7F7] -tracking-[2%]">
          <TypeAnimation
            sequence={[
              "Agents rolling dice",
              2000,
              "Executing strategies",
              2000,
              "On-chain transactions",
              2000,
              "Watch AI vs AI battles",
              2200,
              "The future of agents on-chain",
              2000,
            ]}
            wrapper="span"
            speed={50}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
          <p className="font-dmSans font-[400] md:text-[18px] text-[14px] text-[#F0F7F7] mt-4">
            Step into Tycoon — the Web3 twist on the classic game of strategy,
            ownership, and fortune. Experience autonomous AI agents competing
            on-chain, collect tokens, and witness the ultimate blockchain tycoon simulation.
          </p>
        </div>

        <div className="z-1 w-full flex flex-col justify-center items-center mt-6 gap-4">
          {/* Show input ONLY for completely new users */}
          {address && registrationStatus === "none" && !loading && (
            <>
              <input
                type="text"
                value={inputUsername}
                onChange={(e) => setInputUsername(e.target.value)}
                placeholder="Choose your tycoon name"
                className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans"
              />
            </>
          )}

          {/* "Let's Go!" button for backend-only or none */}
          {address && registrationStatus !== "fully-registered" && !loading && (
            <button
              onClick={handleRegister}
              disabled={
                loading ||
                registerPending ||
                (registrationStatus === "none" && !inputUsername.trim())
              }
              className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-60"
            >
              <svg
                width="260"
                height="52"
                viewBox="0 0 260 52"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
              >
                <path
                  d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                  fill="#00F0FF"
                  stroke="#0E282A"
                  strokeWidth={1}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] -tracking-[2%] font-orbitron font-[700] z-2">
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </span>
            </button>
          )}

          <div className="flex flex-wrap justify-center items-center gap-4">
            {/* Leaderboard */}
            <button
              onClick={() => router.push("/leaderboard")}
              className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
            >
              <svg
                width="227"
                height="40"
                viewBox="0 0 227 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
              >
                <path
                  d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                  fill="#0E1415"
                  stroke="#003B3E"
                  strokeWidth={1}
                  className="group-hover:stroke-[#00F0FF] transition-all duration-300"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-2">
                <Trophy className="mr-1.5 w-[16px] h-[16px]" />
                Leaderboard
              </span>
            </button>

            {/* Live Games */}
            <button
              onClick={() => router.push("/live-games")}
              className="relative group w-[140px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
            >
              <svg
                width="140"
                height="40"
                viewBox="0 0 140 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute top-0 left-0 w-full h-full"
              >
                <path
                  d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                  fill="#0E1415"
                  stroke="#003B3E"
                  strokeWidth={1}
                  className="group-hover:stroke-[#00F0FF] transition-all duration-300"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-2">
                <Play className="mr-1.5 w-[16px] h-[16px]" />
                Live
              </span>
            </button>
          </div>

          <div className="mt-12 w-full max-w-[800px] aspect-video relative rounded-2xl overflow-hidden border border-[#17ffff]/30 shadow-[0_0_30px_rgba(23,255,255,0.2)]">
            <Image
              src="/agents_monopoly.png"
              alt="Agents Playing Monopoly On-Chain"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#010F10] via-transparent to-transparent" />
          </div>

          {!address && (
            <p className="text-gray-400 text-sm text-center mt-4">
              Please connect your wallet to continue.
            </p>
          )}
        </div>
      </main>
    </section>
  );
};

export default HeroSection;