/*
 * CoreBath quotation defaults. Every number here can be changed from the
 * "Rates & settings" panel (admin mode) and exported as cbq-rates.js, so you
 * rarely need to edit this file. All amounts are in INR, excluding GST.
 */
(function (g) {
  g.CBQ = g.CBQ || {};
  g.CBQ.defaults = {
    company: {
      name: "CoreBath",
      tagline: "",
      website: "corebath.in",
      email: "",
      phone: "",
      address: "",
      gstin: "",
      quotePrefix: "CB",
      validityDays: 15,
      paymentTerms: [
        "40% on booking and site measurement",
        "40% on completion of demolition, waterproofing and plumbing",
        "20% on handover",
      ],
      terms: [
        "Prices are for the bathroom size and selections listed. Final price is confirmed after site measurement.",
        "Electrical wiring beyond the points listed, structural repairs and seepage repairs in adjoining rooms are not included unless listed.",
        "Waterproofing is tested by a 24-hour flood test before tiling.",
        "Brand warranties apply to fittings; CoreBath workmanship warranty as per corebath.in.",
      ],
    },

    pricing: {
      productMarkupPct: 0,      // add to dealer/MRP prices to reach your selling price
      gstPct: 18,
      roundTo: 100,             // round grand total to nearest
    },

    // Civil work rates
    services: {
      demolitionPerSqft: 35,         // break and remove old tiles + bed (floor + wall tiled area)
      sanitaryDismantleLump: 1500,   // remove old WC, basin, fittings
      debrisDisposalLump: 3500,      // bag, carry down and dispose
      waterproofPerSqft: 70,         // 2-coat polymer/cementitious with fibre mesh at joints
      waterproofUpturnFt: 1,         // height taken up every wall
      showerWallWpSqft: 36,          // extra wall area waterproofed in the shower zone
      screedPerSqft: 45,             // floor bed with slope to drain
      floorTileLayPerSqft: 55,
      wallTileLayPerSqft: 60,
      adhesiveGroutPerSqft: 25,      // tile adhesive + grout
      tileWastagePct: 10,
      doorDeductionSqft: 17.5,       // 7ft x 2.5ft door opening
      waterPointRate: 1800,          // concealed CPVC hot/cold line per outlet, incl. pressure test
      drainPointRate: 1500,          // uPVC/SWR drain line per outlet
    },

    tileAllowance: { essential: 85, signature: 140, luxe: 240 }, // tile material, Rs/sqft

    // Fixing (installation) labour per unit, by item
    fixing: {
      ewc: 2500, basin: 1200, basin_mixer: 600, diverter_trim: 800, diverter_body: 1200,
      waste_coupling: 150, bottle_trap: 250, angle_valve: 150, health_faucet: 300,
      bath_spout: 400, hand_shower: 300, sliding_rail: 500, flexi_pipe: 0, braided_hose: 100,
      floor_grating: 350, concealed_cistern: 2500, stop_cock: 500, addon: 0, custom: 0,
    },

    // "Unseen" site and project charges
    siteCharges: {
      projectMgmtPct: 8,          // % of products + services + add-ons
      consumablesPct: 4,          // % of services: cement, sand, white cement, silicone, sleeves, fasteners
      siteProtectionLump: 1500,   // covering floors and furniture on the way to the bathroom
      transportLump: 2500,        // material transport and lifting
      cleaningLump: 2500,         // post-work deep cleaning + acid wash
      contingencyPct: 0,
    },

    // Add-ons the engine can recommend. unit: "each" | "sqft_floor" | "sqft_tiled" | "per_drain"
    addons: [
      { key: "overhead_shower", name: "Overhead rain shower 200mm with shower arm", rate: 6500, unit: "each", fixing: 700 },
      { key: "geyser", name: "Storage water heater 15L (5-star) with installation", rate: 10500, unit: "each", fixing: 800, angleValves: 2, elecPoints: 1 },
      { key: "exhaust_fan", name: "Exhaust fan 150mm with louvre", rate: 2400, unit: "each", fixing: 600, elecPoints: 1 },
      { key: "led_mirror", name: "LED mirror 600x800 with anti-fog", rate: 7500, unit: "each", fixing: 500, elecPoints: 1 },
      { key: "vanity", name: "Vanity unit with stone counter, 600mm", rate: 18000, unit: "each", fixing: 1500 },
      { key: "glass_partition", name: "Shower glass partition, 8mm toughened, with hardware", rate: 22000, unit: "each", fixing: 0 },
      { key: "wall_niche", name: "Tiled shower niche (wall recess) with edge profile", rate: 4500, unit: "each", fixing: 0 },
      { key: "niche_light", name: "LED profile light in niche", rate: 3500, unit: "each", fixing: 0, elecPoints: 1 },
      { key: "accessories", name: "Bathroom accessory set (towel rail, ring, robe hook, tumbler, soap dish)", rate: 6000, unit: "each", fixing: 600 },
      { key: "grab_bars", name: "Stainless steel grab bars (set of 2)", rate: 4000, unit: "each", fixing: 600 },
      { key: "anti_skid", name: "Anti-skid floor tile upgrade", rate: 40, unit: "sqft_floor", fixing: 0 },
      { key: "epoxy_grout", name: "Epoxy grout upgrade (stain-proof joints)", rate: 25, unit: "sqft_tiled", fixing: 0 },
      { key: "false_ceiling", name: "Moisture-resistant false ceiling with access panel", rate: 140, unit: "sqft_floor", fixing: 0 },
      { key: "anti_cockroach", name: "Anti-cockroach / odour-lock drain trap", rate: 450, unit: "per_drain", fixing: 0 },
      { key: "smart_seat", name: "Smart bidet seat (warm seat, wash, dryer)", rate: 35000, unit: "each", fixing: 1000, elecPoints: 1 },
      { key: "water_softener", name: "Bathroom water softener (inline)", rate: 14000, unit: "each", fixing: 1500 },
      { key: "elec_point", name: "Electrical point with modular switch and wiring", rate: 900, unit: "each", fixing: 0 },
    ],

    // Optional Claude-powered advisor (see ai/worker.js). Leave blank to use the built-in rules only.
    aiEndpoint: "",
  };
})(typeof window !== "undefined" ? window : globalThis);
