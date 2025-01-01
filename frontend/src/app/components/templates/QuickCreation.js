"use client";
import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { useFormik } from "formik";
import { TextField, Button, InputAdornment } from "@mui/material";
import { styled } from "@mui/system";
import Grid from "@mui/material/Grid2";
import ProfilePictureUploader from "./ProfilePictureUploader";
import { ImCross } from "react-icons/im";
import NumberInputAdornments from "../mui/NumberInput";
import IconButton from "@mui/material/IconButton";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import RingLoader from "react-spinners/RingLoader";
import axios from "axios";
import { Transaction, Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { FaSadCry } from "react-icons/fa";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import bs58 from "bs58";

const SOLANA_RPC =
  process.env.NODE_ENV === "development"
    ? "https://brande-ffqoic-fast-devnet.helius-rpc.com"
    : "https://rosette-xbrug1-fast-mainnet.helius-rpc.com";

const FormSection = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(4),
}));

export default function QuickCreation(props) {
  const { publicKey, sendTransaction, connected, wallet } = useWallet();
  const [generating, setGenerating] = useState(null);
  const [generationError, setGenerationError] = useState(null);
  const [launchLoading, setLaunchLoading] = useState(null);
  const [launchError, setLaunchError] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [generatingModalOpen, setGeneratingModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [settings, setSettings] = useState(null);
  const [newAgentLink, setNewAgentLink] = useState(null);
  const [sample, setSample] = useState(null);

  const formik = useFormik({
    initialValues: {
      pfp: sample?.pfp,
      name: "",
      title: "",
      opening_message: "",
      tldr: "",
      instructions: "",
      secret_keyword: "",
      initial_pool_size: 0.5,
      fee_multiplier: 1,
    },
    validationSchema: Yup.object({
      // pfp: Yup.mixed(),
      name: Yup.string()
        .min(3, "Name must be at least 3 characters")
        .max(16, "Name must be at most 16 characters")
        .required("Name is required"),
      opening_message: Yup.string()
        .min(10, "Intro must be at least 10 characters")
        .max(130, "Intro must be at most 130 characters")
        .required("Intro is required"),
      instructions: Yup.string()
        .min(100, "Instructions must be at least 100 characters")
        .max(10000, "Instructions must be at most 10,000 characters")
        .required("Instructions are required"),
      secret_keyword: Yup.string()
        .min(4, "Secret Keyphrase must be at least 5 characters")
        .max(255, "Secret Keyphrase must be at most 255 characters")
        .required("Secret Keyphrase is required"),
      initial_pool_size: Yup.number()
        .min(0.5, "Initial Pool Size must be at least 0.5")
        .max(10000, "Initial Pool Size must be at most 10,000")
        .required("Initial Pool Size is required"),
      fee_multiplier: Yup.number()
        .min(1, "Fee Multiplier must be at least 1")
        .max(100, "Fee Multiplier must be at most 100")
        .required("Fee Multiplier is required"),
    }),
    onSubmit: (values) => {
      if (
        (typeof values.pfp === "string" && values.pfp.startsWith("/images")) ||
        !values.pfp
      ) {
        setErrorModalOpen("PFP is required");
        return;
      }
      if (!values.instructions.includes(values.secret_keyword)) {
        setErrorModalOpen("Secret Keyphrase must be in the instructions");
        return;
      }
      createTransaction(values);
    },
  });

  const handleClose = () => {
    setGenerationError(null);
    setGenerating(null);
    setLaunchError(null);
    setLaunchLoading(null);
    setLoadingForm(false);
    setImagePreview(null);
    props.onClose();
    formik.resetForm();
  };

  const loadSettings = async () => {
    setLoadingForm(true);
    const data = await axios
      .get(`/api/program/deployment-data`)
      .then((res) => res.data)
      .catch((err) => err);
    setSettings(data.deploymentData);
    setSample(data.sample);
    setLoadingForm(false);
  };

  const createAuthenticatedRequest = async (
    endpoint,
    options = {},
    formData
  ) => {
    // First try using stored JWT
    const storedToken = localStorage.getItem("token");

    let config = {
      url: endpoint,
      method: options.method || "GET",
      headers: {
        ...options.headers,
      },
    };

    // Add FormData configuration if provided
    if (formData instanceof FormData) {
      config = {
        ...config,
        data: formData,
        headers: {
          ...config.headers,
          "Content-Type": "multipart/form-data",
        },
      };
    }

    if (storedToken) {
      try {
        const verifyResponse = await axios.get("/api/auth/verify-token", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
            address: publicKey.toString(),
          },
        });

        if (verifyResponse.status === 200) {
          config.headers.Authorization = `Bearer ${storedToken}`;
          const response = await axios(config);
          return response.data;
        }
      } catch (error) {
        localStorage.removeItem("token");
      }
    }

    if (!connected || !publicKey || !wallet) {
      throw new Error("Wallet not connected");
    }

    try {
      const message = `Authenticate with your wallet: ${Date.now()}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await wallet.adapter.signMessage(encodedMessage);

      config.headers = {
        ...config.headers,
        signature: bs58.encode(signature),
        publickey: publicKey.toString(),
        message: message,
        timestamp: Date.now().toString(),
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error("Authentication error:", error);
      setErrorModalOpen(error.response?.data?.error || error.message);
      throw error;
    }
  };

  const createTransaction = async (values) => {
    setLaunchLoading("Creating Transaction...");
    try {
      const connection = new Connection(SOLANA_RPC, "confirmed");
      const formData = new FormData();
      const tournamentData = {
        sender: props.publicKey,
        name: values.name,
        instructions: values.instructions,
        initial_pool_size: values.initial_pool_size,
        fee_multiplier: values.fee_multiplier,
        opening_message: values.opening_message,
        phrases: [values.secret_keyword],
      };

      // Append the stringified data object and pfp file separately
      formData.append("data", JSON.stringify(tournamentData));
      formData.append("pfp", values.pfp);

      const response = await createAuthenticatedRequest(
        "/api/transactions/create-start-tournament-transaction",
        { method: "POST" },
        formData
      );

      setLaunchLoading("Waiting for confirmation...");
      const { serializedTransaction, tournamentPDA, tournamentId, token } =
        response;

      localStorage.setItem("token", token);
      const transaction = Transaction.from(
        Buffer.from(serializedTransaction, "base64")
      );
      await sendTransaction(transaction, connection)
        .then(async (signedTransaction) => {
          console.log("Transaction sent:", signedTransaction);
          setLaunchLoading("Deploying program...");
          const confirmation = await connection.confirmTransaction({
            signature: signedTransaction,
            commitment: "confirmed",
          });

          if (confirmation.value.err) {
            setErrorModalOpen(error.message);
            setLaunchLoading(null);
            return false;
          }
          quickStartTournament(formData, tournamentPDA, tournamentId, token);
        })
        .catch((error) => {
          console.error("Error sending transaction:", error.message);
          setErrorModalOpen(error.message);
          setLaunchLoading(null);
          return false;
        });
    } catch (error) {
      console.error("Error creating transaction:", error);
      setErrorModalOpen(error.response.data.error);
      setLaunchLoading(null);
    }
  };

  const quickStartTournament = async (
    formData,
    tournamentPDA,
    tournamentId,
    token
  ) => {
    setLaunchLoading("Deploying Agent...");
    try {
      formData.append("tournamentPDA", tournamentPDA);
      formData.append("tournamentId", tournamentId);

      const response = await axios.post(
        "/api/program/quick-start-tournament",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.savedAgent) {
        setNewAgentLink(`/break/${response.data.savedAgent.name}`);
        setLaunchLoading(null);
        handleClose();
        setSuccessModalOpen(true);
      } else {
        setErrorModalOpen(response.data.error);
        setLaunchLoading(null);
      }
    } catch (error) {
      console.error("Error creating transaction:", error);
      setErrorModalOpen(error.response.data.error);
      setLaunchLoading(null);
    }
  };

  const generateAgent = async (e) => {
    e.preventDefault();
    if (!props.connected || !props.publicKey) {
      window.alert("Please connect your wallet");
      return;
    }

    setGeneratingModalOpen(true);
    setGenerating("Generating...");
    setTimeout(() => setGenerating("Crafting Your Unique Agent..."), 5000);
    setTimeout(() => setGenerating("Writing Custom Instructions..."), 10000);
    setTimeout(() => setGenerating("Building Profile..."), 15000);
    setTimeout(() => setGenerating("Generating Profile Picture..."), 20000);
    try {
      const response = await axios.post("/api/program/generate-agent", {
        sender: props.publicKey,
        name: formik.values.name,
        instructions: formik.values.instructions,
        opening_message: formik.values.opening_message,
      });

      const generatedAgent = response.data.newAgent;
      const imageUrl = generatedAgent.imageUrl;

      formik.setFieldValue("name", generatedAgent.name);
      formik.setFieldValue("opening_message", generatedAgent.label);
      formik.setFieldValue("instructions", generatedAgent.instructions);
      formik.setFieldValue("secret_keyword", generatedAgent.phrase);
      formik.setFieldValue("pfp", imageUrl);
      setImagePreview(imageUrl);

      setGenerating(null);
      setGeneratingModalOpen(false);
    } catch (error) {
      console.error("Error generating agent:", error);
      setGenerationError(error.response.data.error);
      setGenerating(null);
      setGeneratingModalOpen(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [props.open]);

  return (
    <SkeletonTheme baseColor="#202020" highlightColor="#444">
      <React.Fragment>
        <Dialog
          sx={{ zIndex: "100000000000" }}
          open={props.open}
          onClose={handleClose}
          className="quick-creation-dialog"
          PaperProps={{
            style: {
              backgroundColor: "#000000",
              color: "#0BBF99",
              minWidth: "200px",
              maxWidth: "500px",
              padding: "40px 60px 20px 60px",
              borderRadius: "20px",
              border: "2px solid #0BBF99",
            },
            component: "form",
            onSubmit: (event) => {
              event.preventDefault();
              formik.handleSubmit();
            },
          }}
        >
          <IconButton
            className="close pointer"
            onClick={handleClose}
            style={{
              position: "absolute",
              top: "15px",
              right: "15px",
              color: "#0BBF99",
            }}
          >
            <ImCross size={16} />
          </IconButton>
          <button
            onClick={(e) => {
              generateAgent(e);
            }}
            className="quick-auto-generate-button pointer"
            style={{
              fontSize: "12px",
              backgroundColor: generationError ? "#FE3448" : "#0BBF99",
              color: "#000",
              border: generationError
                ? "2px solid #FE3448"
                : "2px solid #0BBF99",
              position: "absolute",
              padding: "8px 10px",
              borderRadius: "50px 0px 0px 50px",
              top: "60px",
              right: "0px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {generating && !generationError ? (
              <RingLoader color="#000" size={14} />
            ) : (
              <FaWandMagicSparkles />
            )}
            {generationError ? (
              <span style={{ marginLeft: "5px" }} className="pointer">
                {generationError}
              </span>
            ) : (
              <span style={{ margin: "0px 0px 0px 5px" }} className="pointer">
                {generating ? generating : "Auto Generate (BETA)"}
              </span>
            )}
          </button>
          {/* <DialogTitle sx={{ color: "#0BBF99" }}>Create Agent</DialogTitle> */}
          <DialogContent sx={{ color: "#0BBF99", padding: "0px" }}>
            <div className="quick-creation-form">
              <FormSection>
                <Grid container spacing={1} sx={{ alignItems: "center" }}>
                  <Grid
                    size={{ xs: 12, md: 12, lg: 12 }}
                    sx={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                    }}
                  >
                    <Grid
                      size={{ xs: 4, md: 4, lg: 3 }}
                      sx={{
                        justifyContent: "flex-start",
                        alignItems: "center",
                        placeItems: "center",
                        display: "flex",
                      }}
                      spacing={1}
                    >
                      {!loadingForm ? (
                        <ProfilePictureUploader
                          sample={sample?.pfp}
                          preview={imagePreview}
                          onFileChange={(file) =>
                            formik.setFieldValue("pfp", file)
                          }
                          error={
                            formik.touched.pfp ? formik.errors.pfp : undefined
                          }
                          helperText={
                            formik.touched.pfp && formik.errors.pfp
                              ? formik.errors.pfp
                              : undefined
                          }
                        />
                      ) : (
                        <Skeleton
                          height={100}
                          width={100}
                          style={{ borderRadius: "50%" }}
                        />
                      )}
                    </Grid>
                    <Grid size={{ xs: 8, md: 8, lg: 9 }}>
                      <TextField
                        fullWidth
                        label="Name"
                        name="name"
                        value={formik.values.name}
                        onChange={formik.handleChange}
                        error={
                          formik.touched.name ? formik.errors.name : undefined
                        }
                        helperText={formik.touched.name && formik.errors.name}
                        focused="true"
                        variant="standard"
                        placeholder={sample?.name}
                        autoComplete="off"
                      />
                    </Grid>
                  </Grid>

                  <Grid
                    size={{ xs: 12, md: 12, lg: 12 }}
                    sx={{ marginTop: "10px" }}
                  >
                    <TextField
                      fullWidth
                      label="Intro"
                      name="opening_message"
                      value={formik.values.opening_message}
                      onChange={formik.handleChange}
                      error={
                        formik.touched.opening_message
                          ? formik.errors.opening_message
                          : undefined
                      }
                      helperText={
                        formik.touched.opening_message &&
                        formik.errors.opening_message
                      }
                      focused="true"
                      variant="standard"
                      placeholder={sample?.label}
                      autoComplete="off"
                    />
                  </Grid>
                  {/* <Grid size={{ xs: 12, md: 12, lg: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="TLDR"
                    name="tldr"
                    value={formik.values.tldr}
                    onChange={formik.handleChange}
                    error={formik.touched.tldr ? formik.errors.tldr : undefined}
                    helperText={formik.touched.tldr && formik.errors.tldr}
                    focused="true"
                    variant="standard"
                    placeholder={formik.values.tldr}
                  />
                </Grid> */}
                  <Grid
                    size={{ xs: 12, md: 12, lg: 12 }}
                    sx={{ marginTop: "10px" }}
                  >
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="🤖 Instructions (System Prompt)"
                      name="instructions"
                      value={formik.values.instructions}
                      onChange={formik.handleChange}
                      error={
                        formik.touched.instructions
                          ? formik.errors.instructions
                          : undefined
                      }
                      helperText={
                        formik.touched.instructions &&
                        formik.errors.instructions
                      }
                      focused="true"
                      variant="outlined"
                      placeholder={sample?.instructions}
                      autoComplete="off"
                    />
                  </Grid>
                  <Grid
                    size={{ xs: 12, md: 12, lg: 12 }}
                    sx={{ marginTop: "10px" }}
                  >
                    <TextField
                      autoComplete="off"
                      fullWidth
                      placeholder={sample?.sample_keyword}
                      label={"Secret Keyphrase"}
                      name={"secret_keyword"}
                      value={formik.values.secret_keyword}
                      onChange={formik.handleChange}
                      error={
                        formik.touched.secret_keyword
                          ? formik.errors.secret_keyword
                          : undefined
                      }
                      helperText={
                        formik.touched.secret_keyword &&
                        formik.errors.secret_keyword
                      }
                      variant="outlined"
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">🔒</InputAdornment>
                          ),
                        },
                      }}
                    />
                    <p style={{ fontSize: "12px", margin: "10px 0px 2px" }}>
                      This keyphrase will be used to determine if the agent has
                      been jailbroken.
                    </p>
                    <p style={{ fontSize: "12px", margin: "10px 0px 2px" }}>
                      * Additional security layer added to make it harder to
                      jailbreak.
                    </p>
                  </Grid>
                  <Grid size={{ xs: 6, md: 6, lg: 6 }}>
                    <p style={{ margin: "4px", fontSize: "14px" }}>
                      Initial Pool Size
                    </p>
                    <NumberInputAdornments
                      min={0.5}
                      max={10000}
                      step={0.5}
                      value={formik.values.initial_pool_size}
                      onChange={(val) =>
                        Number(val)
                          ? formik.setFieldValue("initial_pool_size", val)
                          : formik.setFieldValue("initial_pool_size", 0.5)
                      }
                      label="Initial Pool Size"
                      name="initial_pool_size"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, md: 6, lg: 6 }}>
                    <p style={{ margin: "4px", fontSize: "14px" }}>
                      Fee Multiplier
                    </p>
                    <NumberInputAdornments
                      suffix={"%"}
                      min={1}
                      max={100}
                      step={1}
                      value={formik.values.fee_multiplier}
                      onChange={(val) =>
                        Number(val)
                          ? formik.setFieldValue("fee_multiplier", val)
                          : formik.setFieldValue("fee_multiplier", 1)
                      }
                      label="Fee Multiplier"
                      name="fee_multiplier"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 12, lg: 12 }}>
                    <p style={{ margin: "4px", fontSize: "12px" }}>
                      Initial Entry Fee:{" "}
                      {(
                        (formik.values.initial_pool_size *
                          formik.values.fee_multiplier) /
                        100
                      ).toFixed(4)}{" "}
                      SOL
                    </p>
                  </Grid>
                </Grid>
              </FormSection>
            </div>
          </DialogContent>
          <DialogActions
            sx={{ padding: "0px", display: "flex", flexDirection: "column" }}
          >
            {props.connected && props.publicKey ? (
              <Button
                type="submit"
                variant="contained"
                size="large"
                className="pointer launch-agent-button"
                sx={{
                  backgroundColor: "#0BBF99",
                  color: "#000000",
                  margin: "0px auto",
                  width: "100%",
                  fontWeight: "bold",
                  border: "2px solid #0BBF99",
                }}
              >
                {launchLoading ? (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ margin: "5px 5px 0px 0px" }}>
                      {launchLoading}
                    </span>
                    <RingLoader color="#000" size={22} />
                  </div>
                ) : !launchError ? (
                  "LAUNCH AGENT 🚀"
                ) : (
                  <span style={{ color: "#FE3448" }}>{launchError}</span>
                )}
              </Button>
            ) : (
              <WalletMultiButton />
            )}
            <p style={{ fontSize: "14px", margin: "10px 0px 0px" }}>
              Need More Control?{" "}
              <span
                style={{
                  color: "#0BBF99",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
                className="pointer"
                onClick={() => {
                  props.setAdvancedModalOpen(true);
                  handleClose();
                }}
              >
                Check out Advanced Creation
              </span>
            </p>
            {settings?.content?.show_help && (
              <p style={{ fontSize: "14px", margin: "5px 0px 0px" }}>
                Need help? Check out our{" "}
                <a
                  href={settings?.content?.show_help}
                  target="_blank"
                  className="pointer"
                  style={{
                    color: "#0BBF99",
                    fontWeight: "bold",
                  }}
                >
                  tutorial
                </a>
              </p>
            )}
          </DialogActions>
        </Dialog>
        <Dialog
          open={generatingModalOpen}
          sx={{ zIndex: "10000000000000000000000000000000000000" }}
          PaperProps={{
            style: {
              backgroundColor: "#000000",
              color: "#0BBF99",
              padding: "40px",
              borderRadius: "20px",
              border: "2px solid #0BBF99",
              minWidth: "300px",
              textAlign: "center",
            },
          }}
        >
          <DialogContent>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <RingLoader color="#0BBF99" size={50} />
              <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                {generating}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={errorModalOpen}
          sx={{ zIndex: "999999999999999" }}
          PaperProps={{
            style: {
              backgroundColor: "#000000",
              color: "#fe3448",
              padding: "10px",
              borderRadius: "20px",
              border: "2px solid #fe3448",
              minWidth: "300px",
              textAlign: "center",
              position: "absolute",
              bottom: "10px",
              right: "20px",
              width: "100px",
            },
          }}
        >
          <DialogContent sx={{ position: "relative" }}>
            <IconButton
              className="close pointer"
              onClick={() => setErrorModalOpen(false)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                color: "#fe3448",
              }}
            >
              <ImCross size={16} />
            </IconButton>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <FaSadCry size={50} />
              <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                {errorModalOpen}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={successModalOpen}
          onClose={() => setSuccessModalOpen(false)}
          sx={{ zIndex: "10000000000000000000000000000000000000" }}
          PaperProps={{
            style: {
              backgroundColor: "#000000",
              color: "#0BBF99",
              padding: "40px",
              borderRadius: "20px",
              border: "2px solid #0BBF99",
              minWidth: "300px",
              textAlign: "center",
              position: "relative",
            },
          }}
        >
          <IconButton
            className="close pointer"
            onClick={() => setSuccessModalOpen(false)}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              color: "#0BBF99",
            }}
          >
            <ImCross size={16} />
          </IconButton>
          <DialogContent>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <div style={{ fontSize: "40px" }}>🎉</div>
              <div style={{ fontSize: "18px", fontWeight: "bold" }}>
                Agent Successfully Created!
              </div>
              <Button
                onClick={() => {
                  window.open(newAgentLink, "_blank");
                  setSuccessModalOpen(false);
                }}
                className="pointer"
                variant="contained"
                sx={{
                  backgroundColor: "#0BBF99",
                  color: "#000000",
                  fontWeight: "bold",
                  "&:hover": {
                    backgroundColor: "#0BBF99",
                  },
                }}
              >
                View Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </React.Fragment>
    </SkeletonTheme>
  );
}
