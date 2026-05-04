//+------------------------------------------------------------------+
//| Three Candle Execution Controller                                |
//| Indicator-matched model detection with armed BUY/SELL execution   |
//+------------------------------------------------------------------+
#property copyright "Three Candle Execution Controller"
#property version   "1.28-SUPABASE"
#property description "Attach to a chart as an Expert Advisor. BUY/SELL buttons arm the next matching 3-candle model."
#property strict

#include <Trade\Trade.mqh>

CTrade Trade;

enum ENUM_TC_STOP_MODE
{
   STOP_FROM_CANDLE2_LINE = 0,     // Matches indicator C2 low/high line
   STOP_FROM_PATTERN_EXTREME = 1   // Uses lowest/highest of all 3 model candles
};

//====================================================================
// INPUTS
//====================================================================
input group "TRADE"
input double            InpLot                  = 0.01;
input double            InpRiskReward           = 3.0;
input double            InpRiskMoney            = 100.0;
input double            InpRiskMoneyButtonStep  = 10.0;
input int               InpMagic                = 55555;
input int               InpDeviationPoints      = 30;
input int               InpStopBufferPoints     = 0;
input ENUM_TC_STOP_MODE InpStopMode             = STOP_FROM_PATTERN_EXTREME;
input bool              InpFallbackNoInitialSLTP = true;
input bool              InpCloseIfProtectionFails = true;
input double            InpDailyLimitR          = 2.0;
input int               InpDailyLossLimitCount  = 2;

input group "PATTERN"
input bool              InpAllowSweep           = true;
input bool              InpAllowSwingPattern    = true;
input bool              InpShowSignalArrows     = true;
input int               InpSignalLookbackBars   = 150;

input group "FILTERS"
input bool              InpUseSpreadFilter      = false;
input int               InpMaxSpreadPoints      = 5000;
input bool              InpBlockTradeOnHighSpread = false;

input group "LOT PANEL"
input double            InpLotButtonStep        = 0.01;
input double            InpPanelLotMax          = 100.0;
input bool              InpClampLotToBrokerMax  = true;

input group "PARTIAL CLOSE"
input bool              InpPartialCloseEnabled  = false;
input double            InpPC1_RR               = 1.0;
input double            InpPC1_Percent          = 30.0;
input double            InpPC2_RR               = 2.0;
input double            InpPC2_Percent          = 30.0;
input double            InpPC3_RR               = 3.0;
input double            InpPC3_Percent          = 40.0;

input group "BREAK EVEN"
input int               InpBreakEvenPlusPoints  = 1;

input group "PANEL"
input int               InpPanelX               = 10;
input int               InpPanelY               = 10;
input int               InpPanelW               = 950;
input bool              InpAutoFitPanelWidth    = true;


input group "SUPABASE WEB CONTROL"
input bool              InpWebControlEnabled       = true;
input string            InpSupabaseFunctionsUrl    = "https://YOUR_PROJECT_REF.functions.supabase.co";
input string            InpSupabaseEaId            = "PASTE_EA_ID_FROM_WEBSITE";
input string            InpSupabaseEaToken         = "PASTE_EA_SECRET_TOKEN_FROM_WEBSITE";
input int               InpWebPollMilliseconds     = 700;
input int               InpWebTimeoutMs            = 3000;
input bool              InpWebPostLiveState        = true;
input bool              InpWebAllowCloseCommands   = true;

//====================================================================
// CONSTANTS / OBJECT NAMES
//====================================================================
#define ARM_NONE 0
#define ARM_BUY  1
#define ARM_SELL 2

string PX = "TCX_";
string UI = "TCX_UI_";

#define B_BUY       "TCX_UI_B_BUY"
#define B_SELL      "TCX_UI_B_SELL"
#define B_AUTO      "TCX_UI_B_AUTO"
#define B_CANCEL    "TCX_UI_B_CANCEL"
#define B_CLOSE     "TCX_UI_B_CLOSE"
#define B_CLOSE_ALL "TCX_UI_B_CLOSE_ALL"
#define B_CLOSE50   "TCX_UI_B_CLOSE50"
#define B_BE        "TCX_UI_B_BE"
#define B_PC        "TCX_UI_B_PC"
#define B_LOT_UP    "TCX_UI_B_LOT_UP"
#define B_LOT_DN    "TCX_UI_B_LOT_DN"
#define B_RISK_UP   "TCX_UI_B_RISK_UP"
#define B_RISK_DN   "TCX_UI_B_RISK_DN"
#define B_RR_UP     "TCX_UI_B_RR_UP"
#define B_RR_DN     "TCX_UI_B_RR_DN"
#define B_MODE_SAFE "TCX_UI_B_MODE_SAFE"
#define B_MODE_ADV  "TCX_UI_B_MODE_ADV"

#define E_LOT       "TCX_UI_E_LOT"
#define E_RISK      "TCX_UI_E_RISK"
#define E_PC1       "TCX_UI_E_PC1"
#define E_PC2       "TCX_UI_E_PC2"
#define E_PC3       "TCX_UI_E_PC3"

#define EMERGENCY_LABEL "TCX_EMERGENCY_STATUS"

bool HasOurPosition();

//====================================================================
// GLOBAL STATE
//====================================================================
int      g_ArmedMode     = ARM_NONE;
datetime g_LastBarTime   = 0;
bool     g_PanelBuilt    = false;
datetime g_InitTime      = 0;
datetime g_ArmMinSignalTime = 0;
datetime g_LastTradeSignalTime = 0;

double   g_Lot           = 0.01;
double   g_RRTarget      = 3.0;
double   g_RiskMoney     = 100.0;
bool     g_PC_On         = false;
bool     g_AutoArm       = false;
bool     g_AdvancedMode  = false;
double   g_PC1_Pct       = 30.0;
double   g_PC2_Pct       = 30.0;
double   g_PC3_Pct       = 40.0;

ulong    g_StateTicket   = 0;
double   g_InitialVolume = 0.0;
double   g_RiskDistance  = 0.0;
bool     g_PC1_Done      = false;
bool     g_PC2_Done      = false;
bool     g_PC3_Done      = false;
bool     g_BE_Done       = false;

string   g_LastMessage   = "Ready";
color    g_LastMsgColor  = clrSilver;

int      g_X             = 10;
int      g_Y             = 20;
int      g_W             = 1080;
int      g_H             = 1360;


//====================================================================
// SUPABASE WEB STATE
//====================================================================
datetime g_WebLastPollSecond = 0;
datetime g_WebLastPostSecond = 0;
uint     g_WebLastPollTick   = 0;
uint     g_WebLastPostTick   = 0;
bool     g_WebConnected      = false;
string   g_WebLastError      = "";
string   g_WebLastCommandId  = "";

//====================================================================
// STRUCTS
//====================================================================
struct PatternSignal
{
   bool     ok;
   bool     buy;
   bool     swing;
   datetime time;
   double   c1o;
   double   c1c;
   double   c1h;
   double   c1l;
   double   c2o;
   double   c2c;
   double   c2h;
   double   c2l;
   double   c3o;
   double   c3c;
   double   c3h;
   double   c3l;
   double   sl;
   double   breakLevel;
};

//====================================================================
// BASIC HELPERS
//====================================================================
void LogMsg(string tag,string text)
{
   Print("[TCX][",tag,"] ",text);
}

void SetLastMessage(string text,color clr)
{
   g_LastMessage=text;
   g_LastMsgColor=clr;
   LogMsg("STATUS",text);
}

bool TradeRetcodeOK()
{
   uint rc=Trade.ResultRetcode();
   return (rc==TRADE_RETCODE_DONE ||
           rc==TRADE_RETCODE_DONE_PARTIAL ||
           rc==TRADE_RETCODE_PLACED);
}

string ClipText(string text,int maxLen)
{
   if(StringLen(text)<=maxLen)
      return text;
   if(maxLen<=3)
      return StringSubstr(text,0,maxLen);
   return StringSubstr(text,0,maxLen-3)+"...";
}

string ArmStatusText()
{
   if(g_AutoArm)
      return "AUTO ARM";
   if(g_ArmedMode==ARM_BUY)
      return "WAITING BUY MODEL";
   if(g_ArmedMode==ARM_SELL)
      return "WAITING SELL MODEL";
   if(HasOurPosition())
      return "POSITION OPEN";
   return "IDLE";
}

void DrawEmergencyStatus()
{
   if(ObjectFind(0,EMERGENCY_LABEL)<0)
   {
      ObjectCreate(0,EMERGENCY_LABEL,OBJ_LABEL,0,0,0);
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_CORNER,CORNER_LEFT_UPPER);
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_XDISTANCE,12);
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_YDISTANCE,12);
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_FONTSIZE,11);
      ObjectSetString(0,EMERGENCY_LABEL,OBJPROP_FONT,"Arial Bold");
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_SELECTABLE,false);
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_HIDDEN,true);
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_BACK,false);
      ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_ZORDER,1000);
   }

   string text="TCX EA RUNNING | "+_Symbol+" | "+EnumToString(_Period)+" | "+ArmStatusText();
   ObjectSetString(0,EMERGENCY_LABEL,OBJPROP_TEXT,text);
   ObjectSetInteger(0,EMERGENCY_LABEL,OBJPROP_COLOR,clrLime);
}

void ChartHeartbeat()
{
   Comment("");
   ObjectDelete(0,EMERGENCY_LABEL);
}

double BrokerMinLot()
{
   double v=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   if(v<=0.0)
      v=0.01;
   return v;
}

double BrokerMaxLot()
{
   double v=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   if(v<=0.0)
      v=100.0;
   return v;
}

double BrokerStepLot()
{
   double v=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(v<=0.0)
      v=0.01;
   return v;
}

int VolumeDigits()
{
   double step=BrokerStepLot();
   int digits=0;

   while(digits<8 && MathAbs(step-NormalizeDouble(step,digits))>0.0000000001)
      digits++;

   return digits;
}

double NormalizeVolumeDown(double volume)
{
   double step=BrokerStepLot();
   if(step<=0.0)
      step=0.01;

   volume=MathFloor((volume/step)+0.000000001)*step;
   volume=NormalizeDouble(volume,VolumeDigits());

   if(volume+0.000000001<BrokerMinLot())
      return 0.0;

   if(volume>BrokerMaxLot())
      volume=BrokerMaxLot();

   return NormalizeDouble(volume,VolumeDigits());
}

double NormalizeVolumeForOrder(double volume)
{
   double minLot=BrokerMinLot();
   double maxLot=BrokerMaxLot();

   if(volume<minLot)
      volume=minLot;
   if(volume>maxLot)
      volume=maxLot;

   double out=NormalizeVolumeDown(volume);
   if(out<=0.0)
      out=minLot;

   return NormalizeDouble(out,VolumeDigits());
}

double NormalizeVolumeForPanel(double volume)
{
   double minLot=BrokerMinLot();
   double maxLot=InpPanelLotMax;

   if(maxLot<=0.0)
      maxLot=100.0;
   if(InpClampLotToBrokerMax)
      maxLot=MathMin(maxLot,BrokerMaxLot());

   if(volume<minLot)
      volume=minLot;
   if(volume>maxLot)
      volume=maxLot;

   double out=NormalizeVolumeDown(volume);
   if(out<=0.0)
      out=minLot;

   if(out>maxLot)
      out=maxLot;

   return NormalizeDouble(out,VolumeDigits());
}

double CleanNumber(string text,double oldValue,double minValue,double maxValue)
{
   string s=text;
   StringReplace(s,"%","");
   StringReplace(s,"$","");
   string cur=AccountInfoString(ACCOUNT_CURRENCY);
   if(StringLen(cur)>0)
      StringReplace(s,cur,"");
   StringReplace(s,",",".");
   StringTrimLeft(s);
   StringTrimRight(s);

   if(StringLen(s)==0)
      return oldValue;

   double v=StringToDouble(s);
   if(v<minValue)
      v=minValue;
   if(v>maxValue)
      v=maxValue;

   return v;
}

double NormalizeRiskMoney(double value)
{
   if(value<0.01)
      value=0.01;
   if(value>100000000.0)
      value=100000000.0;
   return NormalizeDouble(value,2);
}

double CleanMoney(string text,double oldValue)
{
   return NormalizeRiskMoney(CleanNumber(text,oldValue,0.01,100000000.0));
}

double RiskPercentOfBalance(double riskMoney)
{
   double balance=AccountInfoDouble(ACCOUNT_BALANCE);
   if(balance<=0.0)
      return 0.0;
   return riskMoney*100.0/balance;
}

double CleanPercent(string text,double oldValue)
{
   return NormalizeDouble(CleanNumber(text,oldValue,0.0,100.0),1);
}

string PriceText(double price)
{
   if(price<=0.0)
      return "---";
   return DoubleToString(price,_Digits);
}

double EffectiveRR()
{
   if(g_RRTarget>0.0)
      return g_RRTarget;
   if(InpRiskReward<=0.0)
      return 3.0;
   return InpRiskReward;
}

double ClampPercent(double value)
{
   if(value<0.0)
      value=0.0;
   if(value>100.0)
      value=100.0;
   return NormalizeDouble(value,1);
}

int CurrentSpreadPoints()
{
   return (int)SymbolInfoInteger(_Symbol,SYMBOL_SPREAD);
}

bool SpreadBlocksTrades()
{
   return (InpBlockTradeOnHighSpread && InpUseSpreadFilter);
}

int RequiredStopPoints()
{
   int stops=(int)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL);
   int freeze=(int)SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL);
   int needed=(int)MathMax((double)stops,(double)freeze);
   return needed+1;
}

bool HasEnoughBars()
{
   return Bars(_Symbol,_Period)>=10;
}

//====================================================================
// POSITION HELPERS
//====================================================================
bool SelectOurPosition()
{
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      string sym=PositionGetString(POSITION_SYMBOL);
      long magic=(long)PositionGetInteger(POSITION_MAGIC);

      if(sym==_Symbol && magic==InpMagic)
         return true;
   }

   return false;
}

bool HasOurPosition()
{
   return SelectOurPosition();
}

void SetArmMode(int mode)
{
   g_ArmedMode=mode;
   if(mode!=ARM_NONE)
      g_AutoArm=false;

   if(mode==ARM_NONE)
   {
      g_ArmMinSignalTime=0;
      return;
   }

   datetime currentBar=iTime(_Symbol,_Period,0);
   if(currentBar<=0)
      currentBar=TimeCurrent();

   g_ArmMinSignalTime=currentBar;
}

void SetAutoArm(bool enabled)
{
   g_AutoArm=enabled;

   if(enabled)
   {
      g_ArmedMode=ARM_NONE;
      datetime currentBar=iTime(_Symbol,_Period,0);
      if(currentBar<=0)
         currentBar=TimeCurrent();
      g_ArmMinSignalTime=currentBar;
   }
   else if(g_ArmedMode==ARM_NONE)
   {
      g_ArmMinSignalTime=0;
   }
}

bool IsHedgingAccount()
{
   long mode=AccountInfoInteger(ACCOUNT_MARGIN_MODE);
   return (mode==ACCOUNT_MARGIN_MODE_RETAIL_HEDGING);
}

string StateKey(ulong ticket,string field)
{
   long login=(long)AccountInfoInteger(ACCOUNT_LOGIN);
   return "TCX."+IntegerToString(login)+"."+_Symbol+"."+IntegerToString(InpMagic)+"."+IntegerToString((long)ticket)+"."+field;
}

bool LoadStateValue(ulong ticket,string field,double &value)
{
   string key=StateKey(ticket,field);
   if(!GlobalVariableCheck(key))
      return false;

   value=GlobalVariableGet(key);
   return true;
}

void SavePositionState()
{
   if(g_StateTicket==0)
      return;

   GlobalVariableSet(StateKey(g_StateTicket,"initial_volume"),g_InitialVolume);
   GlobalVariableSet(StateKey(g_StateTicket,"risk_distance"),g_RiskDistance);
   GlobalVariableSet(StateKey(g_StateTicket,"pc1_done"),g_PC1_Done ? 1.0 : 0.0);
   GlobalVariableSet(StateKey(g_StateTicket,"pc2_done"),g_PC2_Done ? 1.0 : 0.0);
   GlobalVariableSet(StateKey(g_StateTicket,"pc3_done"),g_PC3_Done ? 1.0 : 0.0);
   GlobalVariableSet(StateKey(g_StateTicket,"be_done"),g_BE_Done ? 1.0 : 0.0);
}

void ResetLocalTradeState()
{
   g_StateTicket=0;
   g_InitialVolume=0.0;
   g_RiskDistance=0.0;
   g_PC1_Done=false;
   g_PC2_Done=false;
   g_PC3_Done=false;
   g_BE_Done=false;
}

void SyncPositionState()
{
   if(!SelectOurPosition())
   {
      ResetLocalTradeState();
      return;
   }

   ulong ticket=(ulong)PositionGetInteger(POSITION_TICKET);
   double volume=PositionGetDouble(POSITION_VOLUME);
   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double sl=PositionGetDouble(POSITION_SL);
   double risk=MathAbs(entry-sl);

   if(ticket!=g_StateTicket)
   {
      g_StateTicket=ticket;

      double stored=0.0;
      if(LoadStateValue(ticket,"initial_volume",stored) && stored>0.0)
         g_InitialVolume=stored;
      else
         g_InitialVolume=volume;

      if(LoadStateValue(ticket,"risk_distance",stored) && stored>0.0)
         g_RiskDistance=stored;
      else
         g_RiskDistance=risk;

      if(LoadStateValue(ticket,"pc1_done",stored))
         g_PC1_Done=(stored>=0.5);
      else
         g_PC1_Done=false;

      if(LoadStateValue(ticket,"pc2_done",stored))
         g_PC2_Done=(stored>=0.5);
      else
         g_PC2_Done=false;

      if(LoadStateValue(ticket,"pc3_done",stored))
         g_PC3_Done=(stored>=0.5);
      else
         g_PC3_Done=false;

      if(LoadStateValue(ticket,"be_done",stored))
         g_BE_Done=(stored>=0.5);
      else
         g_BE_Done=false;

      SavePositionState();
   }
   else
   {
      if(g_InitialVolume<=0.0)
         g_InitialVolume=volume;
      if(g_RiskDistance<=0.0 && risk>0.0)
         g_RiskDistance=risk;
   }
}

//====================================================================
// PATTERN DETECTION - MATCHES PROVIDED INDICATOR RULES
//====================================================================
void ResetSignal(PatternSignal &sig)
{
   sig.ok=false;
   sig.buy=false;
   sig.swing=false;
   sig.time=0;
   sig.c1o=0.0;
   sig.c1c=0.0;
   sig.c1h=0.0;
   sig.c1l=0.0;
   sig.c2o=0.0;
   sig.c2c=0.0;
   sig.c2h=0.0;
   sig.c2l=0.0;
   sig.c3o=0.0;
   sig.c3c=0.0;
   sig.c3h=0.0;
   sig.c3l=0.0;
   sig.sl=0.0;
   sig.breakLevel=0.0;
}

bool DetectPattern(int shift,bool wantBuy,PatternSignal &sig)
{
   ResetSignal(sig);

   if(!HasEnoughBars())
      return false;
   if(shift<1)
      shift=1;
   if(Bars(_Symbol,_Period)<shift+4)
      return false;

   double c1o=iOpen(_Symbol,_Period,shift+2);
   double c1c=iClose(_Symbol,_Period,shift+2);
   double c1h=iHigh(_Symbol,_Period,shift+2);
   double c1l=iLow(_Symbol,_Period,shift+2);

   double c2o=iOpen(_Symbol,_Period,shift+1);
   double c2c=iClose(_Symbol,_Period,shift+1);
   double c2h=iHigh(_Symbol,_Period,shift+1);
   double c2l=iLow(_Symbol,_Period,shift+1);

   double c3o=iOpen(_Symbol,_Period,shift);
   double c3c=iClose(_Symbol,_Period,shift);
   double c3h=iHigh(_Symbol,_Period,shift);
   double c3l=iLow(_Symbol,_Period,shift);

   if(c1o<=0.0 || c2o<=0.0 || c3o<=0.0)
      return false;

   bool b1=c1c>c1o;
   bool b2=c2c<c2o;
   bool b3=c3c>c3o;
   bool candle1IsLowest=(c1l<c2l && c1l<c3l);
   bool buySweep=InpAllowSweep ? (c2l<=c1l || c3l<=c1l) : true;
   bool buyCloseBreak=c3c>c2o;
   bool buySwing=(c3l<c2l && c3c>c2h);
   bool buyOK=b1 && b2 && b3 && !candle1IsLowest &&
              ((buySweep && buyCloseBreak) || (InpAllowSwingPattern && buySwing));

   bool s1=c1c<c1o;
   bool s2=c2c>c2o;
   bool s3=c3c<c3o;
   bool candle1IsHighest=(c1h>c2h && c1h>c3h);
   bool sellSweep=InpAllowSweep ? (c2h>=c1h || c3h>=c1h) : true;
   bool sellCloseBreak=c3c<c2o;
   bool sellSwing=(c3h>c2h && c3c<c2l);
   bool sellOK=s1 && s2 && s3 && !candle1IsHighest &&
               ((sellSweep && sellCloseBreak) || (InpAllowSwingPattern && sellSwing));

   if(wantBuy && !buyOK)
      return false;
   if(!wantBuy && !sellOK)
      return false;

   sig.ok=true;
   sig.buy=wantBuy;
   sig.swing=wantBuy ? buySwing : sellSwing;
   sig.time=iTime(_Symbol,_Period,shift);
   sig.c1o=c1o;
   sig.c1c=c1c;
   sig.c1h=c1h;
   sig.c1l=c1l;
   sig.c2o=c2o;
   sig.c2c=c2c;
   sig.c2h=c2h;
   sig.c2l=c2l;
   sig.c3o=c3o;
   sig.c3c=c3c;
   sig.c3h=c3h;
   sig.c3l=c3l;

   double buffer=MathMax(0.0,(double)InpStopBufferPoints)*_Point;

   if(wantBuy)
   {
      double baseSL=MathMin(c1l,MathMin(c2l,c3l));
      sig.sl=NormalizeDouble(baseSL-buffer,_Digits);
      sig.breakLevel=sig.swing ? c2h : c2o;
   }
   else
   {
      double baseSL=MathMax(c1h,MathMax(c2h,c3h));
      sig.sl=NormalizeDouble(baseSL+buffer,_Digits);
      sig.breakLevel=sig.swing ? c2l : c2o;
   }

   return true;
}

//====================================================================
// CHART SIGNAL MARKERS
//====================================================================
void DrawSignalMarker(PatternSignal &sig)
{
   if(!InpShowSignalArrows || !sig.ok)
      return;

   string side=sig.buy ? "BUY" : "SELL";
   string name=PX+"SIG_"+side+"_"+IntegerToString((long)sig.time);
   if(ObjectFind(0,name)>=0)
      return;

   double candleRange=MathMax(_Point,MathAbs(sig.c3h-sig.c3l));
   double arrowGap=MathMax(60.0*_Point,candleRange*0.35);
   double textGap=MathMax(95.0*_Point,candleRange*0.55);
   double y=sig.buy ? sig.c3l-arrowGap : sig.c3h+arrowGap;
   double textY=sig.buy ? sig.c3l-textGap : sig.c3h+textGap;

   ObjectCreate(0,name,OBJ_ARROW,0,sig.time,y);
   ObjectSetInteger(0,name,OBJPROP_ARROWCODE,sig.buy ? 233 : 234);
   ObjectSetInteger(0,name,OBJPROP_COLOR,sig.buy ? clrLime : clrTomato);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,1);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);

   string textName=name+"_TXT";
   ObjectCreate(0,textName,OBJ_TEXT,0,sig.time,textY);
   ObjectSetString(0,textName,OBJPROP_TEXT,sig.swing ? side+" SWING" : side);
   ObjectSetInteger(0,textName,OBJPROP_COLOR,sig.buy ? clrLime : clrTomato);
   ObjectSetInteger(0,textName,OBJPROP_FONTSIZE,7);
   ObjectSetString(0,textName,OBJPROP_FONT,"Arial Bold");
   ObjectSetInteger(0,textName,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,textName,OBJPROP_HIDDEN,true);
}

void DeleteTradeLevelObjects()
{
   string tradePrefix=PX+"TRADE_";
   for(int i=ObjectsTotal(0)-1;i>=0;i--)
   {
      string name=ObjectName(0,i);
      if(StringFind(name,tradePrefix)==0)
         ObjectDelete(0,name);
   }
}

void DrawTradeLevels(ulong ticket,bool buy,double sl,double tp)
{
   // UI request: do not draw SL/TP lines on chart.
   // Broker SL/TP still works because trade execution logic is unchanged.
   string base=PX+"TRADE_"+IntegerToString((long)ticket)+"_";
   ObjectDelete(0,base+"SL");
   ObjectDelete(0,base+"TP");
}


void DrawHistoricalSignals()
{
   if(!InpShowSignalArrows)
      return;

   int bars=Bars(_Symbol,_Period);
   int maxShift=MathMin(InpSignalLookbackBars,bars-4);
   if(maxShift<1)
      return;

   for(int shift=maxShift;shift>=1;shift--)
   {
      PatternSignal sig;
      if(DetectPattern(shift,true,sig))
         DrawSignalMarker(sig);
      if(DetectPattern(shift,false,sig))
         DrawSignalMarker(sig);
   }
}

void DrawLatestClosedSignal()
{
   if(!InpShowSignalArrows)
      return;

   PatternSignal sig;
   if(DetectPattern(1,true,sig))
      DrawSignalMarker(sig);
   if(DetectPattern(1,false,sig))
      DrawSignalMarker(sig);
}

//====================================================================
// TRADE VALIDATION / EXECUTION
//====================================================================
bool IsTradingAllowedForDirection(bool buy,string &reason)
{
   reason="";

   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      reason="Terminal Algo Trading is disabled";
      return false;
   }

   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      reason="EA trading permission is disabled";
      return false;
   }

   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
   {
      reason="Account trading is disabled";
      return false;
   }

   long mode=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_MODE);
   if(mode==SYMBOL_TRADE_MODE_DISABLED)
   {
      reason="Symbol trading is disabled";
      return false;
   }
   if(mode==SYMBOL_TRADE_MODE_CLOSEONLY)
   {
      reason="Symbol is close-only";
      return false;
   }
   if(buy && mode==SYMBOL_TRADE_MODE_SHORTONLY)
   {
      reason="Symbol allows sell only";
      return false;
   }
   if(!buy && mode==SYMBOL_TRADE_MODE_LONGONLY)
   {
      reason="Symbol allows buy only";
      return false;
   }

   return true;
}

bool SpreadAllowed(string &reason)
{
   reason="";
   int spread=CurrentSpreadPoints();

   if(SpreadBlocksTrades() && spread>InpMaxSpreadPoints)
   {
      reason="Spread too high: "+IntegerToString(spread)+" pts";
      return false;
   }

   return true;
}

bool ValidateStops(bool buy,double sl,double tp,string &reason)
{
   reason="";

   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);
   int minPts=RequiredStopPoints();
   double minDist=minPts*_Point;

   if(ask<=0.0 || bid<=0.0)
   {
      reason="No valid bid/ask price";
      return false;
   }

   if(buy)
   {
      if(sl>=ask)
      {
         reason="BUY SL is not below entry";
         return false;
      }
      if(tp>0.0 && tp<=ask)
      {
         reason="BUY TP is not above entry";
         return false;
      }
      if(bid-sl<minDist)
      {
         reason="BUY SL too close for broker stop level";
         return false;
      }
      if(tp>0.0 && tp-bid<minDist)
      {
         reason="BUY TP too close for broker stop level";
         return false;
      }
   }
   else
   {
      if(sl<=bid)
      {
         reason="SELL SL is not above entry";
         return false;
      }
      if(tp>0.0 && tp>=bid)
      {
         reason="SELL TP is not below entry";
         return false;
      }
      if(sl-ask<minDist)
      {
         reason="SELL SL too close for broker stop level";
         return false;
      }
      if(tp>0.0 && ask-tp<minDist)
      {
         reason="SELL TP too close for broker stop level";
         return false;
      }
   }

   return true;
}

double MoneyRiskForLot(bool buy,double entry,double sl,double lot)
{
   if(lot<=0.0 || entry<=0.0 || sl<=0.0)
      return 0.0;

   double priceRisk=buy ? (entry-sl) : (sl-entry);
   if(priceRisk<=_Point*0.1)
      return 0.0;

   ENUM_ORDER_TYPE orderType=ORDER_TYPE_BUY;
   if(!buy)
      orderType=ORDER_TYPE_SELL;
   double profit=0.0;
   if(OrderCalcProfit(orderType,_Symbol,lot,entry,sl,profit))
      return MathAbs(profit);

   double tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   double tickValue=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);
   if(tickSize<=0.0 || tickValue<=0.0)
      return 0.0;

   return MathAbs(entry-sl)/tickSize*tickValue*lot;
}

double FitVolumeToFreeMargin(bool buy,double volume,double entry,string &reason)
{
   reason="";

   double minLot=BrokerMinLot();
   double step=BrokerStepLot();
   double lot=NormalizeVolumeDown(volume);
   if(lot<=0.0)
      lot=minLot;

   double freeMargin=AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   if(freeMargin<=0.0)
      return lot;

   ENUM_ORDER_TYPE orderType=ORDER_TYPE_BUY;
   if(!buy)
      orderType=ORDER_TYPE_SELL;
   while(lot+0.000000001>=minLot)
   {
      double margin=0.0;
      if(!OrderCalcMargin(orderType,_Symbol,lot,entry,margin))
         return lot;

      if(margin<=freeMargin)
         return NormalizeDouble(lot,VolumeDigits());

      double nextLot=NormalizeVolumeDown(lot-step);
      if(nextLot<=0.0 || nextLot>=lot)
         break;
      lot=nextLot;
   }

   reason="Not enough free margin for min lot";
   return 0.0;
}

bool CalculateRiskVolume(bool buy,double entry,double sl,double &lot,double &targetRisk,double &actualRisk,string &reason)
{
   lot=0.0;
   actualRisk=0.0;
   reason="";

   targetRisk=NormalizeRiskMoney(g_RiskMoney);

   if(targetRisk<=0.0)
   {
      reason="Risk amount is zero";
      return false;
   }

   double riskPerLot=MoneyRiskForLot(buy,entry,sl,1.0);
   if(riskPerLot<=0.0)
   {
      reason="Cannot calculate risk value for this symbol";
      return false;
   }

   double rawLot=targetRisk/riskPerLot;
   if(rawLot>BrokerMaxLot())
      rawLot=BrokerMaxLot();

   lot=NormalizeVolumeDown(rawLot);
   if(lot<=0.0)
      lot=BrokerMinLot();

   lot=FitVolumeToFreeMargin(buy,lot,entry,reason);
   if(lot<=0.0)
      return false;

   actualRisk=MoneyRiskForLot(buy,entry,sl,lot);
   return true;
}

bool GetRiskReference(bool &buy,double &entry,double &sl)
{
   buy=true;
   entry=0.0;
   sl=0.0;

   if(SelectOurPosition())
   {
      buy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
      entry=PositionGetDouble(POSITION_PRICE_OPEN);
      sl=PositionGetDouble(POSITION_SL);
      if(sl<=0.0 && g_RiskDistance>0.0)
         sl=buy ? entry-g_RiskDistance : entry+g_RiskDistance;
      return (entry>0.0 && sl>0.0);
   }

   PatternSignal sig;
   if(g_ArmedMode==ARM_BUY && DetectPattern(1,true,sig))
   {
      buy=true;
      entry=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
      sl=sig.sl;
      return (entry>0.0 && sl>0.0);
   }
   if(g_ArmedMode==ARM_SELL && DetectPattern(1,false,sig))
   {
      buy=false;
      entry=SymbolInfoDouble(_Symbol,SYMBOL_BID);
      sl=sig.sl;
      return (entry>0.0 && sl>0.0);
   }
   if(DetectPattern(1,true,sig))
   {
      buy=true;
      entry=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
      sl=sig.sl;
      return (entry>0.0 && sl>0.0);
   }
   if(DetectPattern(1,false,sig))
   {
      buy=false;
      entry=SymbolInfoDouble(_Symbol,SYMBOL_BID);
      sl=sig.sl;
      return (entry>0.0 && sl>0.0);
   }

   return false;
}

string RiskPreviewText()
{
   double targetRisk=NormalizeRiskMoney(g_RiskMoney);

   if(SelectOurPosition())
   {
      bool posBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
      double entry=PositionGetDouble(POSITION_PRICE_OPEN);
      double sl=PositionGetDouble(POSITION_SL);
      double volume=PositionGetDouble(POSITION_VOLUME);
      if(sl<=0.0 && g_RiskDistance>0.0)
         sl=posBuy ? entry-g_RiskDistance : entry+g_RiskDistance;

      double openRisk=MoneyRiskForLot(posBuy,entry,sl,volume);
      double openPct=RiskPercentOfBalance(openRisk);
      return "Open risk "+MoneyText(openRisk)+
             " ("+DoubleToString(openPct,2)+"%) | Target "+MoneyText(targetRisk);
   }

   bool buy=true;
   double entry=0.0;
   double sl=0.0;
   if(!GetRiskReference(buy,entry,sl))
      return "Risk "+MoneyText(targetRisk)+" | wait model SL";

   double lot=0.0;
   double actualRisk=0.0;
   string reason="";
   if(CalculateRiskVolume(buy,entry,sl,lot,targetRisk,actualRisk,reason))
   {
      return "Risk "+MoneyText(targetRisk)+
             " | Auto lot "+DoubleToString(lot,VolumeDigits());
   }

   return "Risk "+MoneyText(targetRisk)+" | "+reason;
}

bool EnforceActualProtection(ulong ticket,bool buy,double sl,double &tp)
{
   if(!PositionSelectByTicket(ticket))
      return false;

   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double risk=buy ? (entry-sl) : (sl-entry);
   if(risk<=_Point)
   {
      SetLastMessage("Trade opened but SL risk is invalid",clrTomato);
      return false;
   }

   tp=buy ? entry+risk*EffectiveRR() : entry-risk*EffectiveRR();
   sl=NormalizeDouble(sl,_Digits);
   tp=NormalizeDouble(tp,_Digits);

   string reason="";
   if(!ValidateStops(buy,sl,tp,reason))
   {
      SetLastMessage("Protection check failed: "+reason,clrTomato);
      return false;
   }

   double oldSL=PositionGetDouble(POSITION_SL);
   double oldTP=PositionGetDouble(POSITION_TP);
   bool needModify=(MathAbs(oldSL-sl)>_Point*0.5 || MathAbs(oldTP-tp)>_Point*0.5);

   if(needModify)
   {
      if(!Trade.PositionModify(ticket,sl,tp) || !TradeRetcodeOK())
      {
         SetLastMessage("SL/TP modify failed: "+Trade.ResultRetcodeDescription(),clrTomato);
         return false;
      }
   }

   return true;
}

void CloseUnprotectedPosition(ulong ticket,string why)
{
   if(ticket==0)
      return;

   if(PositionSelectByTicket(ticket))
   {
      Trade.PositionClose(ticket);
      ResetLocalTradeState();
   }

   SetLastMessage(why,clrTomato);
}

bool ExecuteSignal(PatternSignal &sig)
{
   if(!sig.ok)
      return false;

   string reason="";

   if(!IsTradingAllowedForDirection(sig.buy,reason))
   {
      SetLastMessage(reason,clrTomato);
      return false;
   }

   if(!SpreadAllowed(reason))
   {
      SetLastMessage(reason,clrTomato);
      return false;
   }

   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);
   double entry=sig.buy ? ask : bid;
   double sl=NormalizeDouble(sig.sl,_Digits);
   double risk=sig.buy ? (entry-sl) : (sl-entry);

   if(risk<=_Point)
   {
      SetLastMessage("Signal risk invalid - SL is too close",clrTomato);
      return false;
   }

   double tp=sig.buy ? entry+risk*EffectiveRR() : entry-risk*EffectiveRR();
   tp=NormalizeDouble(tp,_Digits);

   if(!ValidateStops(sig.buy,sl,tp,reason))
   {
      SetLastMessage(reason,clrTomato);
      return false;
   }

   double lot=0.0;
   double targetRisk=0.0;
   double actualRisk=0.0;
   if(!CalculateRiskVolume(sig.buy,entry,sl,lot,targetRisk,actualRisk,reason))
   {
      SetLastMessage("Risk lot failed: "+reason,clrTomato);
      return false;
   }

   g_Lot=NormalizeDouble(lot,VolumeDigits());
   RefreshLotEdit();

   bool ok=false;
   string comment=sig.swing ? "TCX Swing" : "TCX Model";

   if(sig.buy)
      ok=Trade.Buy(lot,_Symbol,0.0,sl,tp,comment+" BUY");
   else
      ok=Trade.Sell(lot,_Symbol,0.0,sl,tp,comment+" SELL");

   if(!ok || !TradeRetcodeOK())
   {
      string firstError=Trade.ResultRetcodeDescription();

      if(!InpFallbackNoInitialSLTP)
      {
         SetLastMessage("Order failed: "+firstError,clrTomato);
         return false;
      }

      if(sig.buy)
         ok=Trade.Buy(lot,_Symbol,0.0,0.0,0.0,comment+" BUY protect");
      else
         ok=Trade.Sell(lot,_Symbol,0.0,0.0,0.0,comment+" SELL protect");

      if(!ok || !TradeRetcodeOK())
      {
         SetLastMessage("Order failed: "+firstError+" | retry "+Trade.ResultRetcodeDescription(),clrTomato);
         return false;
      }
   }

   Sleep(150);

   if(!SelectOurPosition())
   {
      SetLastMessage("Order sent, position not found yet",clrGold);
      return true;
   }

   ulong ticket=(ulong)PositionGetInteger(POSITION_TICKET);
   bool resultBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
   double finalTP=tp;
   bool protectionOK=true;

   if(resultBuy==sig.buy)
      protectionOK=EnforceActualProtection(ticket,sig.buy,sl,finalTP);
   else
   {
      SyncPositionState();
      SetLastMessage("Order sent - existing net position adjusted",clrGold);
      return true;
   }

   if(!protectionOK && InpCloseIfProtectionFails)
   {
      CloseUnprotectedPosition(ticket,(sig.buy ? "BUY" : "SELL")+" closed - SL/TP protection failed");
      return false;
   }

   g_StateTicket=ticket;
   g_InitialVolume=PositionGetDouble(POSITION_VOLUME);
   g_RiskDistance=MathAbs(PositionGetDouble(POSITION_PRICE_OPEN)-sl);
   g_PC1_Done=false;
   g_PC2_Done=false;
   g_PC3_Done=false;
   g_BE_Done=false;
   SavePositionState();

   DrawTradeLevels(ticket,sig.buy,sl,finalTP);

   if(protectionOK)
   {
      SetLastMessage((sig.buy ? "BUY" : "SELL")+" placed | Lot "+DoubleToString(lot,VolumeDigits())+
                     " | Risk "+MoneyText(actualRisk)+
                     " | SL "+PriceText(sl)+" | TP "+PriceText(finalTP),clrLime);
   }
   else
   {
      SetLastMessage((sig.buy ? "BUY" : "SELL")+" placed - check SL/TP message in Experts tab",clrGold);
   }

   return true;
}

void TryArmedExecution()
{
   if(g_ArmedMode==ARM_NONE && !g_AutoArm)
      return;

   PatternSignal sig;
   bool wantBuy=(g_ArmedMode==ARM_BUY);

   if(g_AutoArm)
   {
      if(DetectPattern(1,true,sig))
         wantBuy=true;
      else if(DetectPattern(1,false,sig))
         wantBuy=false;
      else
         return;
   }
   else
   {
      if(!DetectPattern(1,wantBuy,sig))
         return;
   }

   if(g_ArmMinSignalTime>0 && sig.time<g_ArmMinSignalTime)
      return;

   if(g_LastTradeSignalTime>0 && sig.time==g_LastTradeSignalTime)
      return;

   DrawSignalMarker(sig);

   string signalText=(wantBuy ? "BUY" : "SELL");
   if(sig.swing)
      signalText+=" swing";

   SetLastMessage(signalText+" model found - sending order",clrGold);

   bool keepAuto=g_AutoArm;
   if(ExecuteSignal(sig))
   {
      g_LastTradeSignalTime=sig.time;
      if(keepAuto)
         g_ArmedMode=ARM_NONE;
      else
      {
         SetArmMode(ARM_NONE);
         g_AutoArm=false;
      }
   }
}

//====================================================================
// PARTIAL CLOSE / BREAK EVEN / CLOSE ALL
//====================================================================
bool DoPartialCloseLevel(int level,double pct,double rrLevel,bool &markDone)
{
   markDone=false;

   if(!SelectOurPosition())
      return false;

   ulong ticket=(ulong)PositionGetInteger(POSITION_TICKET);
   double volume=PositionGetDouble(POSITION_VOLUME);

   if(g_InitialVolume<=0.0)
      g_InitialVolume=volume;

   double rawLot=g_InitialVolume*pct/100.0;
   double closeLot=NormalizeVolumeDown(rawLot);
   double minLot=BrokerMinLot();
   double step=BrokerStepLot();

   if(closeLot<=0.0)
   {
      SetLastMessage("PC"+IntegerToString(level)+" skipped - lot too small",clrGold);
      markDone=true;
      return false;
   }

   if(closeLot>volume)
      closeLot=NormalizeVolumeDown(volume);

   if(closeLot<=0.0)
   {
      SetLastMessage("PC"+IntegerToString(level)+" skipped - no closable volume",clrGold);
      markDone=true;
      return false;
   }

   bool closeFull=false;
   if(closeLot>=volume-step*0.1)
      closeFull=true;
   else if(volume-closeLot<minLot)
   {
      double adjusted=NormalizeVolumeDown(volume-minLot);
      if(adjusted<=0.0)
      {
         SetLastMessage("PC"+IntegerToString(level)+" skipped - would leave less than min lot",clrGold);
         markDone=true;
         return false;
      }
      closeLot=adjusted;
   }

   bool ok=false;
   bool isBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);

   if(closeFull)
   {
      ok=Trade.PositionClose(ticket);
   }
   else if(IsHedgingAccount())
   {
      ok=Trade.PositionClosePartial(ticket,closeLot);
   }
   else
   {
      if(isBuy)
         ok=Trade.Sell(closeLot,_Symbol,0.0,0.0,0.0,"TCX partial reduce");
      else
         ok=Trade.Buy(closeLot,_Symbol,0.0,0.0,0.0,"TCX partial reduce");
   }

   if(ok && TradeRetcodeOK())
   {
      SetLastMessage("PC"+IntegerToString(level)+" booked "+DoubleToString(closeLot,VolumeDigits())+
                     " lot at "+DoubleToString(rrLevel,1)+"R",clrLime);
      markDone=true;
      return true;
   }

   SetLastMessage("PC"+IntegerToString(level)+" failed: "+Trade.ResultRetcodeDescription(),clrTomato);
   return false;
}

void MonitorPartialClose()
{
   if(!g_PC_On)
      return;
   if(!SelectOurPosition())
      return;

   SyncPositionState();

   bool isBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double sl=PositionGetDouble(POSITION_SL);
   double price=isBuy ? SymbolInfoDouble(_Symbol,SYMBOL_BID) : SymbolInfoDouble(_Symbol,SYMBOL_ASK);

   if(g_RiskDistance<=0.0)
      g_RiskDistance=MathAbs(entry-sl);
   if(g_RiskDistance<=0.0)
      return;

   double profitDistance=isBuy ? price-entry : entry-price;
   double rr=profitDistance/g_RiskDistance;

   if(rr<0.0)
      return;

   bool mark=false;

   if(!g_PC1_Done && g_PC1_Pct>0.0 && rr>=InpPC1_RR)
   {
      DoPartialCloseLevel(1,g_PC1_Pct,InpPC1_RR,mark);
      if(mark)
      {
         g_PC1_Done=true;
         SavePositionState();
      }
      return;
   }

   if(!g_PC2_Done && g_PC2_Pct>0.0 && rr>=InpPC2_RR)
   {
      DoPartialCloseLevel(2,g_PC2_Pct,InpPC2_RR,mark);
      if(mark)
      {
         g_PC2_Done=true;
         SavePositionState();
      }
      return;
   }

   if(!g_PC3_Done && g_PC3_Pct>0.0 && rr>=InpPC3_RR)
   {
      DoPartialCloseLevel(3,g_PC3_Pct,InpPC3_RR,mark);
      if(mark)
      {
         g_PC3_Done=true;
         SavePositionState();
      }
      return;
   }
}

void MoveToBreakEven()
{
   int found=0;
   int moved=0;
   int already=0;
   int failed=0;
   string lastFail="";

   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      string sym=PositionGetString(POSITION_SYMBOL);
      long magic=(long)PositionGetInteger(POSITION_MAGIC);
      if(sym!=_Symbol || magic!=InpMagic)
         continue;

      found++;

      bool isBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
      double entry=PositionGetDouble(POSITION_PRICE_OPEN);
      double oldSL=PositionGetDouble(POSITION_SL);
      double tp=PositionGetDouble(POSITION_TP);
      double newSL=isBuy ? entry+InpBreakEvenPlusPoints*_Point
                         : entry-InpBreakEvenPlusPoints*_Point;

      newSL=NormalizeDouble(newSL,_Digits);

      if(isBuy && oldSL>=newSL && oldSL>0.0)
      {
         already++;
         continue;
      }
      if(!isBuy && oldSL<=newSL && oldSL>0.0)
      {
         already++;
         continue;
      }

      string reason="";
      if(!ValidateStops(isBuy,newSL,tp,reason))
      {
         failed++;
         lastFail=reason;
         continue;
      }

      if(Trade.PositionModify(ticket,newSL,tp) && TradeRetcodeOK())
      {
         moved++;
         if(ticket==g_StateTicket)
         {
            g_BE_Done=true;
            SavePositionState();
         }
      }
      else
      {
         failed++;
         lastFail=Trade.ResultRetcodeDescription();
      }
   }

   if(found==0)
      SetLastMessage("No open position for break even",clrGold);
   else if(moved>0)
      SetLastMessage("Stop moved to break even on "+IntegerToString(moved)+" position(s)",clrLime);
   else if(failed>0)
      SetLastMessage("BE failed: "+lastFail,clrTomato);
   else if(already>0)
      SetLastMessage("Break even already protected",clrGold);
}

void CloseAllPositions()
{
   bool any=false;

   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      string sym=PositionGetString(POSITION_SYMBOL);
      long magic=(long)PositionGetInteger(POSITION_MAGIC);
      if(sym!=_Symbol || magic!=InpMagic)
         continue;

      any=true;
      Trade.PositionClose(ticket);
   }

   SetArmMode(ARM_NONE);
   ResetLocalTradeState();

   if(any)
      SetLastMessage("Close command sent",clrGold);
   else
      SetLastMessage("No matching position to close",clrGold);
}

void CloseCurrentPercent(double pct)
{
   if(pct<=0.0)
      return;

   if(!SelectOurPosition())
   {
      SetLastMessage("No matching position to close",clrGold);
      return;
   }

   ulong ticket=(ulong)PositionGetInteger(POSITION_TICKET);
   double volume=PositionGetDouble(POSITION_VOLUME);
   bool isBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
   double minLot=BrokerMinLot();
   double closeLot=NormalizeVolumeDown(volume*pct/100.0);

   if(closeLot<=0.0)
   {
      SetLastMessage("Close "+DoubleToString(pct,0)+"% skipped - lot too small",clrGold);
      return;
   }

   if(volume-closeLot<minLot)
      closeLot=volume;

   bool ok=false;
   if(closeLot>=volume)
      ok=Trade.PositionClose(ticket);
   else if(IsHedgingAccount())
      ok=Trade.PositionClosePartial(ticket,closeLot);
   else
   {
      if(isBuy)
         ok=Trade.Sell(closeLot,_Symbol,0.0,0.0,0.0,"TCX manual close");
      else
         ok=Trade.Buy(closeLot,_Symbol,0.0,0.0,0.0,"TCX manual close");
   }

   if(ok && TradeRetcodeOK())
      SetLastMessage("Closed "+DoubleToString(closeLot,VolumeDigits())+" lot",clrLime);
   else
      SetLastMessage("Close failed: "+Trade.ResultRetcodeDescription(),clrTomato);
}

//====================================================================
// UI HELPERS
//====================================================================
void CalcPanelGeometry()
{
   int chartW=(int)ChartGetInteger(0,CHART_WIDTH_IN_PIXELS);
   int chartH=(int)ChartGetInteger(0,CHART_HEIGHT_IN_PIXELS);

   g_X=InpPanelX;
   g_Y=InpPanelY;

   if(g_X<0)
      g_X=0;
   if(g_Y<0)
      g_Y=0;

   int wantedW=InpPanelW;

   // Clean side-controller width. Keep it wide enough for all blocks,
   // but never force horizontal overflow on smaller charts.
   if(wantedW<930)
      wantedW=930;
   if(wantedW>1120)
      wantedW=1120;

   g_W=wantedW;

   if(InpAutoFitPanelWidth && chartW>100)
   {
      int fitW=chartW-g_X-12;
      if(fitW>=900)
         g_W=MathMin(wantedW,fitW);
      else
         g_W=MathMax(860,fitW);
   }

   if(g_W<860)
      g_W=860;
   if(g_W>1120)
      g_W=1120;

   // Content-fit height: removes the bad empty full-height area while keeping
   // every block readable and aligned.
   g_H=732;
}

void Rect(string name,int x,int y,int w,int h,color bg,int z=1)
{
   ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,name,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,name,OBJPROP_YSIZE,h);
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_COLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,z);
}

void Border(string name,int x,int y,int w,int h,color clr)
{
   Rect(name+"_T",x,y,w,2,clr,2);
   Rect(name+"_B",x,y+h-2,w,2,clr,2);
   Rect(name+"_L",x,y,2,h,clr,2);
   Rect(name+"_R",x+w-2,y,2,h,clr,2);
}

void Txt(string name,string text,int x,int y,color clr,int size,bool bold=false,int z=20)
{
   ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   int uiSize=size;
   if(uiSize>=22) uiSize-=6;
   else if(uiSize>=18) uiSize-=5;
   else if(uiSize>=14) uiSize-=3;
   else if(uiSize>=10) uiSize-=1;
   if(uiSize<6) uiSize=6;
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,uiSize);
   ObjectSetString(0,name,OBJPROP_FONT,bold ? "Arial Bold" : "Arial");
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,z);
}


void DotLabel(string name,int x,int y,color clr,int size=22,int z=30)
{
   ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetString(0,name,OBJPROP_TEXT,"●");
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,size);
   ObjectSetString(0,name,OBJPROP_FONT,"Arial Black");
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,z);
}

void SetDotColor(string name,bool enabled,color onColor)
{
   if(ObjectFind(0,name)<0)
      return;

   ObjectSetString(0,name,OBJPROP_TEXT,"●");
   ObjectSetInteger(0,name,OBJPROP_COLOR,enabled ? onColor : C'38,45,62');
}

void SetCandleDotColor(string name,bool valid,bool aboveOpen)
{
   if(ObjectFind(0,name)<0)
      return;

   ObjectSetString(0,name,OBJPROP_TEXT,"●");
   if(!valid)
   {
      ObjectSetInteger(0,name,OBJPROP_COLOR,C'38,45,62');
      return;
   }

   ObjectSetInteger(0,name,OBJPROP_COLOR,aboveOpen ? C'20,225,75' : C'245,38,38');
}

void Btn(string name,string text,int x,int y,int w,int h,color bg,color fg,int size=9)
{
   ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_BUTTON,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,name,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,name,OBJPROP_YSIZE,h);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_COLOR,fg);
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_BORDER_COLOR,C'70,78,105');
   int uiSize=size;
   if(uiSize>=22) uiSize-=6;
   else if(uiSize>=18) uiSize-=5;
   else if(uiSize>=14) uiSize-=3;
   else if(uiSize>=10) uiSize-=1;
   if(uiSize<6) uiSize=6;
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,uiSize);
   ObjectSetString(0,name,OBJPROP_FONT,"Arial Bold");
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,50);
   ObjectSetInteger(0,name,OBJPROP_STATE,false);
}

void EditBox(string name,string text,int x,int y,int w,int h,color bg,color fg,int size=10)
{
   ObjectDelete(0,name);
   ObjectCreate(0,name,OBJ_EDIT,0,0,0);
   ObjectSetInteger(0,name,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,name,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,name,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,name,OBJPROP_YSIZE,h);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_COLOR,fg);
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_BORDER_COLOR,C'85,95,125');
   int uiSize=size;
   if(uiSize>=22) uiSize-=6;
   else if(uiSize>=18) uiSize-=5;
   else if(uiSize>=14) uiSize-=3;
   else if(uiSize>=10) uiSize-=1;
   if(uiSize<6) uiSize=6;
   ObjectSetInteger(0,name,OBJPROP_FONTSIZE,uiSize);
   ObjectSetString(0,name,OBJPROP_FONT,"Arial Bold");
   ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_ZORDER,70);
   ObjectSetInteger(0,name,OBJPROP_READONLY,false);
   ObjectSetInteger(0,name,OBJPROP_ALIGN,ALIGN_CENTER);
}

void SetTxt(string name,string text,color clr)
{
   if(ObjectFind(0,name)<0)
      return;
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_COLOR,clr);
}

void SetRect(string name,color bg)
{
   if(ObjectFind(0,name)<0)
      return;
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_COLOR,bg);
}

void SetBtn(string name,color bg,color fg,string text="")
{
   if(ObjectFind(0,name)<0)
      return;
   ObjectSetInteger(0,name,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,name,OBJPROP_COLOR,fg);
   if(text!="")
      ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_STATE,false);
}

void SetEditText(string name,double value,int digits)
{
   if(ObjectFind(0,name)<0)
      return;
   ObjectSetString(0,name,OBJPROP_TEXT,DoubleToString(value,digits));
}

void SectionTitle(string key,string title,int x,int y,int w,color bg,color fg)
{
   Rect(UI+key+"_BG",x,y,w,26,bg,5);
   Txt(UI+key+"_TXT",title,x+12,y+5,fg,8,true,25);
}

datetime DayStart(datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t,dt);
   dt.hour=0;
   dt.min=0;
   dt.sec=0;
   return StructToTime(dt);
}

string MoneyText(double v)
{
   string cur=AccountInfoString(ACCOUNT_CURRENCY);
   if(StringLen(cur)>0)
      return cur+" "+DoubleToString(v,2);
   return DoubleToString(v,2);
}

string SignedMoneyText(double v)
{
   string s=MoneyText(MathAbs(v));
   if(v>0.0)
      return "+"+s;
   if(v<0.0)
      return "-"+s;
   return s;
}

void CalcDealStats(datetime fromTime,int &trades,int &wins,int &losses,double &net,double &grossProfit,double &grossLoss)
{
   trades=0;
   wins=0;
   losses=0;
   net=0.0;
   grossProfit=0.0;
   grossLoss=0.0;

   if(!HistorySelect(fromTime,TimeCurrent()))
      return;

   int total=HistoryDealsTotal();
   for(int i=0;i<total;i++)
   {
      ulong deal=HistoryDealGetTicket(i);
      if(deal==0)
         continue;

      if(HistoryDealGetString(deal,DEAL_SYMBOL)!=_Symbol)
         continue;
      if((long)HistoryDealGetInteger(deal,DEAL_MAGIC)!=InpMagic)
         continue;

      long entry=HistoryDealGetInteger(deal,DEAL_ENTRY);
      if(entry!=DEAL_ENTRY_OUT && entry!=DEAL_ENTRY_INOUT && entry!=DEAL_ENTRY_OUT_BY)
         continue;

      double p=HistoryDealGetDouble(deal,DEAL_PROFIT)+
               HistoryDealGetDouble(deal,DEAL_SWAP)+
               HistoryDealGetDouble(deal,DEAL_COMMISSION);

      trades++;
      net+=p;

      if(p>0.0)
      {
         wins++;
         grossProfit+=p;
      }
      else if(p<0.0)
      {
         losses++;
         grossLoss+=MathAbs(p);
      }
   }
}

double OpenProfit()
{
   double p=0.0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong ticket=PositionGetTicket(i);
      if(ticket==0)
         continue;

      if(PositionGetString(POSITION_SYMBOL)==_Symbol &&
         (long)PositionGetInteger(POSITION_MAGIC)==InpMagic)
         p+=PositionGetDouble(POSITION_PROFIT);
   }
   return p;
}

double CurrentPositionRR()
{
   if(!SelectOurPosition())
      return 0.0;

   bool isBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double price=isBuy ? SymbolInfoDouble(_Symbol,SYMBOL_BID) : SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double risk=g_RiskDistance;

   if(risk<=0.0)
      risk=MathAbs(entry-PositionGetDouble(POSITION_SL));
   if(risk<=0.0)
      return 0.0;

   double move=isBuy ? price-entry : entry-price;
   return move/risk;
}

string SessionName()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(),dt);

   if(dt.hour>=13 && dt.hour<22)
      return "NEW YORK";
   if(dt.hour>=7 && dt.hour<16)
      return "LONDON";
   if(dt.hour>=0 && dt.hour<7)
      return "ASIA";
   return "OFF HOURS";
}

string SessionTimeLeft()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(),dt);

   int endHour=24;
   if(dt.hour>=13 && dt.hour<22)
      endHour=22;
   else if(dt.hour>=7 && dt.hour<16)
      endHour=16;
   else if(dt.hour>=0 && dt.hour<7)
      endHour=7;

   int mins=(endHour-dt.hour)*60-dt.min;
   if(mins<0)
      mins=0;

   return IntegerToString(mins/60)+"H "+IntegerToString(mins%60)+"M";
}

string CandleCloseTimerText()
{
   int periodSeconds=PeriodSeconds(_Period);
   datetime barOpen=iTime(_Symbol,_Period,0);
   if(periodSeconds<=0 || barOpen<=0)
      return "--:--";

   long elapsed=(long)(TimeCurrent()-barOpen);
   long left=(long)periodSeconds-elapsed;
   if(left<0)
      left=0;

   if(left>=3600)
      return StringFormat("%02d:%02d:%02d",(int)(left/3600),(int)((left%3600)/60),(int)(left%60));

   return StringFormat("%02d:%02d",(int)(left/60),(int)(left%60));
}

int QualityScore()
{
   int score=0;

   if(TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) && MQLInfoInteger(MQL_TRADE_ALLOWED))
      score++;
   if(AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
      score++;
   if(!SpreadBlocksTrades() || CurrentSpreadPoints()<=InpMaxSpreadPoints)
      score++;
   string tradeReason="";
   if(IsTradingAllowedForDirection(true,tradeReason) || IsTradingAllowedForDirection(false,tradeReason))
      score++;
   if(g_ArmedMode!=ARM_NONE || g_AutoArm)
      score++;
   if(HasEnoughBars())
      score++;

   PatternSignal sig;
   if(DetectPattern(1,true,sig) || DetectPattern(1,false,sig))
      score+=2;

   if(score>8)
      score=8;
   return score;
}

string QualityText(int score)
{
   if(score>=7)
      return "A+++";
   if(score>=5)
      return "B";
   return "C";
}

color QualityColor(int score)
{
   if(score>=7)
      return clrLime;
   if(score>=5)
      return clrGold;
   return clrTomato;
}

void CardBox(string key,string title,string v1,string l2,string v2,int x,int y,int w,int h,color accent)
{
   Rect(UI+key+"_BOX",x,y,w,h,C'10,16,30',4);
   Border(UI+key+"_BRD",x,y,w,h,C'24,36,58');
   Txt(UI+key+"_T",title,x+16,y+14,C'185,195,220',8,true,25);
   Txt(UI+key+"_V1",v1,x+16,y+42,accent,15,true,25);
   Txt(UI+key+"_L2",l2,x+16,y+78,C'150,160,185',8,true,25);
   Txt(UI+key+"_V2",v2,x+16,y+96,clrWhite,10,true,25);
}

void StatBox(string key,string title,string value,int x,int y,int w,int h,color valueColor)
{
   Rect(UI+key+"_BOX",x,y,w,h,C'9,14,27',4);
   Border(UI+key+"_BRD",x,y,w,h,C'24,34,52');
   Txt(UI+key+"_T",title,x+12,y+14,C'150,160,185',8,true,25);
   Txt(UI+key+"_V",value,x+12,y+38,valueColor,13,true,25);
}

void MiniCard(string key,string title,string v1,string l2,string v2,int x,int y,int w,int h,color accent)
{
   Rect(UI+key+"_BOX",x,y,w,h,C'8,15,29',4);
   Border(UI+key+"_BRD",x,y,w,h,C'22,36,58');

   if(h<=70)
   {
      Txt(UI+key+"_T",title,x+9,y+5,C'160,174,204',6,true,25);
      Txt(UI+key+"_V1",v1,x+9,y+20,accent,10,true,25);
      Txt(UI+key+"_L2",l2,x+9,y+38,C'120,136,166',6,true,25);
      Txt(UI+key+"_V2",v2,x+9,y+49,clrWhite,7,true,25);
      return;
   }

   Txt(UI+key+"_T",title,x+10,y+9,C'160,174,204',6,true,25);
   Txt(UI+key+"_V1",v1,x+10,y+29,accent,11,true,25);
   Txt(UI+key+"_L2",l2,x+10,y+59,C'120,136,166',6,true,25);
   Txt(UI+key+"_V2",v2,x+10,y+74,clrWhite,8,true,25);
}


void MiniStat(string key,string title,string value,int x,int y,int w,int h,color valueColor)
{
   Rect(UI+key+"_BOX",x,y,w,h,C'8,14,26',4);
   Border(UI+key+"_BRD",x,y,w,h,C'24,34,52');

   if(h<=32)
   {
      Txt(UI+key+"_T",title,x+7,y+4,C'140,154,184',6,true,25);
      Txt(UI+key+"_V",value,x+7,y+17,valueColor,7,true,25);
      return;
   }

   Txt(UI+key+"_T",title,x+8,y+6,C'140,154,184',6,true,25);
   Txt(UI+key+"_V",value,x+8,y+23,valueColor,8,true,25);
}


void MetricRow(string key,string leftTitle,string leftValue,string rightTitle,string rightValue,
               int x,int y,int w,int h,color leftColor,color rightColor)
{
   int mid=x+w/2;
   Rect(UI+key+"_BOX",x,y,w,h,C'8,13,24',4);
   Border(UI+key+"_BRD",x,y,w,h,C'24,36,58');
   Txt(UI+key+"_L1",leftTitle,x+8,y+6,C'150,165,195',7,true,25);
   Txt(UI+key+"_V1",leftValue,x+8,y+20,leftColor,10,true,25);
   Txt(UI+key+"_L2",rightTitle,mid+6,y+6,C'150,165,195',7,true,25);
   Txt(UI+key+"_V2",rightValue,mid+6,y+20,rightColor,10,true,25);
}


//====================================================================
// LIVE CANDLE / SWEEP STRUCTURE PANEL
//====================================================================
int H4BlockNumber(datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t,dt);
   return (dt.hour/4)+1; // broker-server day: 1,2,3,4,5,6
}

bool LatestH4ShiftByParity(bool wantOdd,int &shiftOut)
{
   shiftOut=-1;
   int bars=iBars(_Symbol,PERIOD_H4);
   if(bars<2)
      return false;

   int maxScan=MathMin(bars-1,30);
   for(int sh=0; sh<=maxScan; sh++)
   {
      datetime t=iTime(_Symbol,PERIOD_H4,sh);
      if(t<=0)
         continue;

      int block=H4BlockNumber(t);
      bool isOdd=((block%2)==1);
      if(isOdd==wantOdd)
      {
         shiftOut=sh;
         return true;
      }
   }

   return false;
}

bool PriceAboveOpen(ENUM_TIMEFRAMES tf,int shift,bool &aboveOpen)
{
   aboveOpen=false;
   if(iBars(_Symbol,tf)<=shift)
      return false;

   double op=iOpen(_Symbol,tf,shift);
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);
   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double price=bid;
   if(price<=0.0)
      price=ask;
   if(op<=0.0 || price<=0.0)
      return false;

   aboveOpen=(price>=op);
   return true;
}

bool StandardSweep(ENUM_TIMEFRAMES tf,bool &highSweep,bool &lowSweep)
{
   highSweep=false;
   lowSweep=false;

   if(iBars(_Symbol,tf)<3)
      return false;

   double h0=iHigh(_Symbol,tf,0);
   double l0=iLow(_Symbol,tf,0);
   double h1=iHigh(_Symbol,tf,1);
   double l1=iLow(_Symbol,tf,1);

   if(h0<=0.0 || l0<=0.0 || h1<=0.0 || l1<=0.0)
      return false;

   highSweep=(h0>h1+_Point*0.1);
   lowSweep=(l0<l1-_Point*0.1);
   return true;
}

bool H4ParitySweep(bool wantOdd,bool &highSweep,bool &lowSweep)
{
   highSweep=false;
   lowSweep=false;

   int sh=-1;
   if(!LatestH4ShiftByParity(wantOdd,sh))
      return false;

   if(iBars(_Symbol,PERIOD_H4)<=sh+1)
      return false;

   double h=iHigh(_Symbol,PERIOD_H4,sh);
   double l=iLow(_Symbol,PERIOD_H4,sh);
   double prevH=iHigh(_Symbol,PERIOD_H4,sh+1);
   double prevL=iLow(_Symbol,PERIOD_H4,sh+1);

   if(h<=0.0 || l<=0.0 || prevH<=0.0 || prevL<=0.0)
      return false;

   highSweep=(h>prevH+_Point*0.1);
   lowSweep=(l<prevL-_Point*0.1);
   return true;
}

void BuildCandleStructureRow(string key,string label,int x,int y,int w,int rowH)
{
   Rect(UI+key+"_SEP",x+12,y+rowH-1,w-24,1,C'24,36,58',6);
   Txt(UI+key+"_L",label,x+20,y+6,clrWhite,8,true,25);
   // Smaller dot with more vertical padding = no overflow outside the row.
   DotLabel(UI+key+"_DOT",x+w-56,y+5,C'38,45,62',13,35);
}

void BuildSweepStructureRow(string key,string label,int x,int y,int w,int rowH)
{
   Rect(UI+key+"_SEP",x+12,y+rowH-1,w-24,1,C'24,36,58',6);
   Txt(UI+key+"_L",label,x+18,y+6,clrWhite,8,true,25);

   int highX=x+w/2-62;
   int lowX=x+w-142;

   Txt(UI+key+"_HT","High",highX,y+7,clrWhite,7,false,25);
   DotLabel(UI+key+"_HDOT",highX+62,y+5,C'38,45,62',13,35);

   Txt(UI+key+"_LT","Low",lowX,y+7,clrWhite,7,false,25);
   DotLabel(UI+key+"_LDOT",lowX+66,y+5,C'38,45,62',13,35);
}

int BuildStructureSections(int x,int y,int w)
{
   int gap=10;
   int h=176;
   int leftW=(w-gap)/2;
   int rightW=w-leftW-gap;
   int leftX=x;
   int rightX=x+leftW+gap;
   int rowH=30;
   int rowY=y+48;

   Rect(UI+"CS_BG",leftX,y,leftW,h,C'5,11,22',4);
   Border(UI+"CS_BRD",leftX,y,leftW,h,C'28,46,74');
   Rect(UI+"CS_ACC",leftX,y,4,h,C'0,140,255',6);
   Txt(UI+"CS_TITLE","CANDLE STRUCTURE",leftX+18,y+14,C'25,155,255',10,true,25);
   Txt(UI+"CS_NOTE","price vs open",leftX+leftW-132,y+18,C'110,130,160',6,false,25);

   BuildCandleStructureRow("CS_D1","D1",leftX+8,rowY,leftW-16,rowH);
   rowY+=rowH;
   BuildCandleStructureRow("CS_H4O","H4  Odd",leftX+8,rowY,leftW-16,rowH);
   rowY+=rowH;
   BuildCandleStructureRow("CS_H4E","H4  Even",leftX+8,rowY,leftW-16,rowH);
   rowY+=rowH;
   BuildCandleStructureRow("CS_H1","H1",leftX+8,rowY,leftW-16,rowH);

   rowY=y+48;
   Rect(UI+"SW_BG",rightX,y,rightW,h,C'5,11,22',4);
   Border(UI+"SW_BRD",rightX,y,rightW,h,C'28,46,74');
   Rect(UI+"SW_ACC",rightX,y,4,h,C'0,140,255',6);
   Txt(UI+"SW_TITLE","SWEEP STRUCTURE",rightX+18,y+14,C'25,155,255',10,true,25);
   Txt(UI+"SW_NOTE","high red | low green",rightX+rightW-172,y+18,C'110,130,160',6,false,25);

   BuildSweepStructureRow("SW_H1","H1",rightX+8,rowY,rightW-16,rowH);
   rowY+=rowH;
   BuildSweepStructureRow("SW_H4O","H4  Odd",rightX+8,rowY,rightW-16,rowH);
   rowY+=rowH;
   BuildSweepStructureRow("SW_H4E","H4  Even",rightX+8,rowY,rightW-16,rowH);
   rowY+=rowH;
   BuildSweepStructureRow("SW_D1","D1",rightX+8,rowY,rightW-16,rowH);

   return h;
}

void UpdateStructureSections()
{
   bool above=false;
   bool valid=false;
   int sh=-1;

   // Candle Structure:
   // Green = live price above opening.
   // Red   = live price below opening.
   valid=PriceAboveOpen(PERIOD_D1,0,above);
   SetCandleDotColor(UI+"CS_D1_DOT",valid,above);

   valid=PriceAboveOpen(PERIOD_H1,0,above);
   SetCandleDotColor(UI+"CS_H1_DOT",valid,above);

   bool oddAbove=false;
   bool validOdd=LatestH4ShiftByParity(true,sh);
   if(validOdd)
      validOdd=PriceAboveOpen(PERIOD_H4,sh,oddAbove);
   SetCandleDotColor(UI+"CS_H4O_DOT",validOdd,oddAbove);

   bool evenAbove=false;
   bool validEven=LatestH4ShiftByParity(false,sh);
   if(validEven)
      validEven=PriceAboveOpen(PERIOD_H4,sh,evenAbove);
   SetCandleDotColor(UI+"CS_H4E_DOT",validEven,evenAbove);

   // Sweep Structure:
   // High sweep = red light.
   // Low sweep  = green light.
   // If both swept, both lights stay ON.
   bool hi=false;
   bool lo=false;

   valid=StandardSweep(PERIOD_H1,hi,lo);
   SetDotColor(UI+"SW_H1_HDOT",valid && hi,C'245,38,38');
   SetDotColor(UI+"SW_H1_LDOT",valid && lo,C'20,225,75');

   valid=H4ParitySweep(true,hi,lo);
   SetDotColor(UI+"SW_H4O_HDOT",valid && hi,C'245,38,38');
   SetDotColor(UI+"SW_H4O_LDOT",valid && lo,C'20,225,75');

   valid=H4ParitySweep(false,hi,lo);
   SetDotColor(UI+"SW_H4E_HDOT",valid && hi,C'245,38,38');
   SetDotColor(UI+"SW_H4E_LDOT",valid && lo,C'20,225,75');

   valid=StandardSweep(PERIOD_D1,hi,lo);
   SetDotColor(UI+"SW_D1_HDOT",valid && hi,C'245,38,38');
   SetDotColor(UI+"SW_D1_LDOT",valid && lo,C'20,225,75');
}

void BuildPanel()
{
   CalcPanelGeometry();
   ObjectsDeleteAll(0,UI);

   int x=g_X;
   int y=g_Y;
   int W=g_W;
   int H=g_H;

   int pad=18;
   int gap=10;
   int inner=W-pad*2;

   color bg=C'3,8,16';
   color card=C'7,13,24';
   color card2=C'15,18,38';
   color border=C'24,38,62';
   color soft=C'150,165,195';
   color title=clrWhite;

   int cy=y+10;

   Rect(UI+"BG",x,y,W,H,bg,1);
   Border(UI+"BORDER",x,y,W,H,C'18,38,64');

   // Header only. Removed account balance, daily P&L, spread and time-server cards.
   int headerH=50;
   Txt(UI+"TITLE","3-CANDLE EA v6.9",x+pad,cy+2,clrWhite,13,true,25);
   Txt(UI+"SUB",ClipText(_Symbol+" | "+EnumToString(_Period)+" | Clean Pro Controller",68),x+pad,cy+28,C'145,170,215',8,true,25);
   Txt(UI+"CONN","EA ON",x+W-86,cy+5,clrLime,8,true,25);
   Txt(UI+"VPS","ONLINE",x+W-86,cy+25,clrLime,7,true,25);
   cy+=headerH+gap;

   // Status + daily lock row. This keeps useful lock info but removes the requested cards.
   int statusH=72;
   int dlockW=260;
   int statusW=inner-dlockW-gap;

   Rect(UI+"STBG",x+pad,cy,statusW,statusH,card2,4);
   Border(UI+"STBRD",x+pad,cy,statusW,statusH,border);
   Txt(UI+"STLBL","STATUS",x+pad+16,cy+9,soft,8,true,25);
   Txt(UI+"STVAL","WAITING FOR SETUP",x+pad+16,cy+28,clrWhite,15,true,25);
   Txt(UI+"STSUB","Arm BUY or SELL and wait for next fresh model",x+pad+16,cy+54,C'180,190,215',8,true,25);

   int dlx=x+pad+statusW+gap;
   Rect(UI+"DLOCK_BOX",dlx,cy,dlockW,statusH,card,4);
   Border(UI+"DLOCK_BRD",dlx,cy,dlockW,statusH,border);
   Txt(UI+"DLOCK_T","DAILY LOSS LOCK",dlx+14,cy+9,soft,7,true,25);
   Txt(UI+"DLOCK_V1","0 / 2",dlx+14,cy+28,clrGold,13,true,25);
   Txt(UI+"DLOCK_L2","STATUS",dlx+126,cy+11,soft,7,true,25);
   Txt(UI+"DLOCK_V2","ACTIVE",dlx+126,cy+31,clrLime,9,true,25);
   cy+=statusH+gap;

   // Candle + Sweep structure. Real-time dots update from OnTimer().
   cy+=BuildStructureSections(x+pad,cy,inner)+gap;

   // Arming + quality row.
   int leftW=(inner-gap)*65/100;
   int rightW=inner-leftW-gap;
   int mainH=150;

   Rect(UI+"ARMBG",x+pad,cy,leftW,mainH,card,4);
   Border(UI+"ARMBRD",x+pad,cy,leftW,mainH,border);
   Txt(UI+"ARMT","ARMING CONTROLS",x+pad+16,cy+12,title,10,true,25);

   int armY=cy+46;
   int armBtnW=(leftW-52)/3;
   Btn(B_BUY,"ARM BUY",x+pad+16,armY,armBtnW,38,C'0,120,50',clrWhite,9);
   Btn(B_AUTO,"AUTO ARM",x+pad+26+armBtnW,armY,armBtnW,38,C'25,36,52',clrWhite,9);
   Btn(B_SELL,"ARM SELL",x+pad+36+armBtnW*2,armY,armBtnW,38,C'145,28,28',clrWhite,9);

   int armInfoY=cy+102;
   int armCol=(leftW-32)/4;
   Txt(UI+"ASL","ARM STATUS",x+pad+16,armInfoY,soft,7,true,25);
   Txt(UI+"ASV","OFF",x+pad+16,armInfoY+18,clrSilver,8,true,25);
   Txt(UI+"ATL","ARM TIMER",x+pad+16+armCol,armInfoY,soft,7,true,25);
   Txt(UI+"ATV","00:00:00",x+pad+16+armCol,armInfoY+18,clrWhite,9,true,25);
   Txt(UI+"BIASL","CC TIMER",x+pad+16+armCol*2,armInfoY,soft,7,true,25);
   Txt(UI+"BIASV","--:--",x+pad+16+armCol*2,armInfoY+18,clrDeepSkyBlue,8,true,25);
   Txt(UI+"CONFL","CONFIRM",x+pad+16+armCol*3,armInfoY,soft,7,true,25);
   Txt(UI+"CONFV","NO",x+pad+16+armCol*3,armInfoY+18,clrSilver,8,true,25);

   Rect(UI+"QUALBG",x+pad+leftW+gap,cy,rightW,mainH,card,4);
   Border(UI+"QUALBRD",x+pad+leftW+gap,cy,rightW,mainH,border);
   Txt(UI+"QUALT","TRADE QUALITY SCORE",x+pad+leftW+gap+16,cy+12,title,10,true,25);
   Txt(UI+"QUALV","0 / 8",x+pad+leftW+gap+36,cy+48,clrWhite,20,true,25);
   Txt(UI+"QUALS","WAITING",x+pad+leftW+gap+36,cy+86,C'180,190,215',7,true,25);
   Rect(UI+"QUALBARBG",x+pad+leftW+gap+22,cy+110,rightW-44,6,C'30,38,52',5);
   Rect(UI+"QUALBARA",x+pad+leftW+gap+22,cy+110,(rightW-44)/3,6,C'35,175,80',6);
   Rect(UI+"QUALBARB",x+pad+leftW+gap+22+(rightW-44)/3,cy+110,(rightW-44)/3,6,C'225,170,24',6);
   Rect(UI+"QUALBARC",x+pad+leftW+gap+22+(rightW-44)*2/3,cy+110,(rightW-44)/3,6,C'210,45,36',6);
   Txt(UI+"QUALR1","7-8 A+++",x+pad+leftW+gap+24,cy+128,clrLime,7,true,25);
   Txt(UI+"QUALR2","5-6 B",x+pad+leftW+gap+108,cy+128,clrGold,7,true,25);
   Txt(UI+"QUALR3","0-4 C",x+pad+leftW+gap+174,cy+128,clrTomato,7,true,25);
   cy+=mainH+gap;

   // Risk + mode row.
   int riskW=(inner-gap)*65/100;
   int modeW=inner-riskW-gap;
   int rowH=150;

   Rect(UI+"RISKBG",x+pad,cy,riskW,rowH,card,4);
   Border(UI+"RISKBRD",x+pad,cy,riskW,rowH,border);
   Txt(UI+"RISKT","RISK MANAGEMENT",x+pad+16,cy+12,title,10,true,25);

   int groupY=cy+44;
   int groupH=72;
   int groupGap=10;
   int groupW=(riskW-32-groupGap*2)/3;
   int gx=x+pad+16;

   Rect(UI+"LOTBOX",gx,groupY,groupW,groupH,C'9,16,30',4);
   Border(UI+"LOTBOXBRD",gx,groupY,groupW,groupH,C'22,36,58');
   Txt(UI+"LOTL","LOT SIZE",gx+10,groupY+8,soft,7,true,25);
   Btn(B_LOT_DN,"-",gx+10,groupY+35,28,28,C'24,34,48',clrWhite,9);
   EditBox(E_LOT,DoubleToString(g_Lot,VolumeDigits()),gx+43,groupY+35,66,28,C'12,18,30',clrWhite,9);
   Btn(B_LOT_UP,"+",gx+114,groupY+35,28,28,C'24,34,48',clrWhite,9);

   gx+=groupW+groupGap;
   Rect(UI+"RISKBOX",gx,groupY,groupW,groupH,C'9,16,30',4);
   Border(UI+"RISKBOXBRD",gx,groupY,groupW,groupH,C'22,36,58');
   Txt(UI+"RISKL","RISK "+AccountInfoString(ACCOUNT_CURRENCY),gx+10,groupY+8,soft,7,true,25);
   Btn(B_RISK_DN,"-",gx+10,groupY+35,28,28,C'24,34,48',clrWhite,9);
   EditBox(E_RISK,DoubleToString(g_RiskMoney,2),gx+43,groupY+35,78,28,C'12,18,30',clrWhite,9);
   Btn(B_RISK_UP,"+",gx+126,groupY+35,28,28,C'24,34,48',clrWhite,9);

   gx+=groupW+groupGap;
   Rect(UI+"RRBOX",gx,groupY,groupW,groupH,C'9,16,30',4);
   Border(UI+"RRBOXBRD",gx,groupY,groupW,groupH,C'22,36,58');
   Txt(UI+"RRL","RR TARGET",gx+10,groupY+8,soft,7,true,25);
   Btn(B_RR_DN,"-",gx+10,groupY+35,28,28,C'24,34,48',clrWhite,9);
   Txt(UI+"RRV","1:3.0",gx+48,groupY+42,clrWhite,9,true,25);
   Btn(B_RR_UP,"+",gx+114,groupY+35,28,28,C'24,34,48',clrWhite,9);

   Txt(UI+"LOTRANGE","Min -- Step -- Max --",x+pad+16,cy+126,C'120,135,165',7,false,25);
   Txt(UI+"RISKAMT","Risk --",x+pad+riskW/2-38,cy+126,C'120,135,165',7,false,25);
   Txt(UI+"RRTXT","TP 3R | SL model",x+pad+riskW-158,cy+126,C'120,135,165',7,false,25);

   Rect(UI+"MODEBG",x+pad+riskW+gap,cy,modeW,rowH,card,4);
   Border(UI+"MODEBRD",x+pad+riskW+gap,cy,modeW,rowH,border);
   Txt(UI+"MODET","TRADE MODE",x+pad+riskW+gap+16,cy+12,title,10,true,25);
   Btn(B_MODE_SAFE,"SAFE MODE",x+pad+riskW+gap+16,cy+44,(modeW-44)/2,32,C'0,95,170',clrWhite,8);
   Btn(B_MODE_ADV,"ADVANCED",x+pad+riskW+gap+28+(modeW-44)/2,cy+44,(modeW-44)/2,32,C'24,34,48',clrWhite,8);
   Btn(B_PC,g_PC_On ? "PART ON" : "PART OFF",x+pad+riskW+gap+16,cy+95,72,24,g_PC_On ? C'20,150,65' : C'92,34,34',clrWhite,7);
   Txt(UI+"PCSTAT","Partials OFF",x+pad+riskW+gap+94,cy+99,C'180,190,210',7,true,25);
   EditBox(E_PC1,DoubleToString(g_PC1_Pct,0),x+pad+riskW+gap+184,cy+93,36,24,C'12,18,30',clrYellow,7);
   EditBox(E_PC2,DoubleToString(g_PC2_Pct,0),x+pad+riskW+gap+226,cy+93,36,24,C'12,18,30',clrYellow,7);
   EditBox(E_PC3,DoubleToString(g_PC3_Pct,0),x+pad+riskW+gap+268,cy+93,36,24,C'12,18,30',clrYellow,7);
   Txt(UI+"MODE4","BE READY",x+pad+riskW+gap+16,cy+126,C'150,165,195',7,false,25);
   cy+=rowH+gap;

   // Message footer. Account statistics and position info are removed.
   int msgH=52;
   Rect(UI+"MSGBG",x+pad,cy,inner,msgH,card,4);
   Border(UI+"MSGBRD",x+pad,cy,inner,msgH,border);
   Txt(UI+"MSGT","MESSAGE",x+pad+16,cy+9,soft,7,true,25);
   Txt(UI+"MSG","Ready",x+pad+16,cy+28,C'150,165,195',7,true,25);

   int manageBtnW=62;
   int manageGap=8;
   int manageX=x+pad+inner-(manageBtnW*4+manageGap*3)-12;
   int manageY=cy+14;
   Btn(B_CLOSE,"CLOSE",manageX,manageY,manageBtnW,26,C'80,12,18',clrWhite,7);
   Btn(B_BE,"BE",manageX+manageBtnW+manageGap,manageY,manageBtnW,26,C'0,70,115',clrWhite,7);
   Btn(B_CLOSE50,"50%",manageX+(manageBtnW+manageGap)*2,manageY,manageBtnW,26,C'90,65,0',clrWhite,7);
   Btn(B_CLOSE_ALL,"ALL",manageX+(manageBtnW+manageGap)*3,manageY,manageBtnW,26,C'55,16,95',clrWhite,7);

   g_PanelBuilt=true;
}

void UpdatePanel()
{
   if(!g_PanelBuilt)
      return;

   bool hasPos=HasOurPosition();
   double balance=AccountInfoDouble(ACCOUNT_BALANCE);
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   datetime now=TimeCurrent();

   int totalTrades=0,wins=0,losses=0;
   double totalNet=0.0,grossProfit=0.0,grossLoss=0.0;
   CalcDealStats((datetime)0,totalTrades,wins,losses,totalNet,grossProfit,grossLoss);

   int dayTrades=0,dayWins=0,dayLosses=0;
   double dayNet=0.0,dayGrossProfit=0.0,dayGrossLoss=0.0;
   CalcDealStats(DayStart(now),dayTrades,dayWins,dayLosses,dayNet,dayGrossProfit,dayGrossLoss);

   double riskMoney=NormalizeRiskMoney(g_RiskMoney);
   double dayR=(riskMoney>0.0 ? dayNet/riskMoney : 0.0);
   double remainingR=MathMax(0.0,InpDailyLimitR-MathMax(0.0,-dayR));
   int score=QualityScore();
   double openPL=OpenProfit();
   double rr=CurrentPositionRR();
   double rrPct=0.0;
   if(EffectiveRR()>0.0)
      rrPct=MathMax(0.0,MathMin(100.0,rr/EffectiveRR()*100.0));

   string timeText=TimeToString(now,TIME_SECONDS);
   string dateText=TimeToString(now,TIME_DATE);

   if(hasPos)
   {
      SetRect(UI+"STBG",C'16,44,24');
      SetTxt(UI+"STVAL","POSITION OPEN",C'110,255,165');
      SetTxt(UI+"STSUB","Managing SL, TP, BE and partials",C'180,190,215');
   }
   else if(g_AutoArm)
   {
      SetRect(UI+"STBG",C'28,35,12');
      SetTxt(UI+"STVAL","AUTO WAIT",clrGold);
      SetTxt(UI+"STSUB","Next fresh BUY or SELL model will enter",C'180,190,215');
   }
   else if(g_ArmedMode==ARM_BUY)
   {
      SetRect(UI+"STBG",C'5,50,18');
      SetTxt(UI+"STVAL","BUY WAIT",C'80,255,140');
      SetTxt(UI+"STSUB","Next fresh BUY setup will enter",C'180,190,215');
   }
   else if(g_ArmedMode==ARM_SELL)
   {
      SetRect(UI+"STBG",C'52,10,10');
      SetTxt(UI+"STVAL","SELL WAIT",C'255,105,105');
      SetTxt(UI+"STSUB","Next fresh SELL setup will enter",C'180,190,215');
   }
   else
   {
      SetRect(UI+"STBG",C'18,21,42');
      SetTxt(UI+"STVAL","WAITING",clrWhite);
      SetTxt(UI+"STSUB","Arm BUY or SELL and wait for next model",C'180,190,215');
   }

   SetBtn(B_BUY,g_ArmedMode==ARM_BUY ? C'15,210,90' : C'8,120,55',clrWhite,
          g_ArmedMode==ARM_BUY ? "ARM BUY ON" : "ARM BUY");
   SetBtn(B_AUTO,g_AutoArm ? C'0,95,170' : C'24,34,48',clrWhite,
          g_AutoArm ? "AUTO ON" : "AUTO ARM");
   SetBtn(B_SELL,g_ArmedMode==ARM_SELL ? C'230,48,48' : C'150,28,28',clrWhite,
          g_ArmedMode==ARM_SELL ? "ARM SELL ON" : "ARM SELL");
   SetBtn(B_PC,g_PC_On ? C'20,150,65' : C'92,34,34',clrWhite,g_PC_On ? "PART ON" : "PART OFF");
   SetBtn(B_MODE_SAFE,g_AdvancedMode ? C'24,34,48' : C'0,95,170',clrWhite);
   SetBtn(B_MODE_ADV,g_AdvancedMode ? C'0,95,170' : C'24,34,48',clrWhite);
   SetBtn(B_CLOSE,hasPos ? C'110,18,24' : C'36,42,54',clrWhite);
   SetBtn(B_BE,hasPos ? C'0,88,145' : C'36,42,54',clrWhite);
   SetBtn(B_CLOSE50,hasPos ? C'120,84,0' : C'36,42,54',clrWhite);
   SetBtn(B_CLOSE_ALL,hasPos ? C'74,26,126' : C'36,42,54',clrWhite);

   int sp=CurrentSpreadPoints();
   string lotRange="Min "+DoubleToString(BrokerMinLot(),VolumeDigits())+
                   " Step "+DoubleToString(BrokerStepLot(),VolumeDigits())+
                   " Max "+DoubleToString(BrokerMaxLot(),VolumeDigits());
   SetTxt(UI+"LOTRANGE",ClipText(lotRange,44),(SpreadBlocksTrades() && sp>InpMaxSpreadPoints) ? clrTomato : C'120,135,165');

   SetTxt(UI+"BAL_V1",ClipText(MoneyText(balance),16),clrDeepSkyBlue);
   SetTxt(UI+"BAL_V2",ClipText(MoneyText(equity),16),clrWhite);
   SetTxt(UI+"DPNL_V1",DoubleToString(dayR,2)+"R",dayNet>=0.0 ? clrLime : clrTomato);
   SetTxt(UI+"DPNL_V2",DoubleToString(remainingR,2)+"R",remainingR>0.0 ? clrLime : clrTomato);
   SetTxt(UI+"DLOCK_V1",IntegerToString(dayLosses)+" / "+IntegerToString(InpDailyLossLimitCount),
          dayLosses<InpDailyLossLimitCount ? clrGold : clrTomato);
   SetTxt(UI+"DLOCK_V2",dayLosses<InpDailyLossLimitCount ? "ACTIVE" : "LOCKED",
          dayLosses<InpDailyLossLimitCount ? clrLime : clrTomato);
   SetTxt(UI+"SPRD_V1",IntegerToString(sp)+" p",(SpreadBlocksTrades() && sp>InpMaxSpreadPoints) ? clrTomato : clrLime);
   SetTxt(UI+"SPRD_V2",SpreadBlocksTrades() ? "BLOCK" : "NO BLOCK",SpreadBlocksTrades() ? clrGold : clrLime);
   SetTxt(UI+"TIME_V1",timeText,clrWhite);
   SetTxt(UI+"TIME_V2",ClipText(dateText,14),clrWhite);

   UpdateStructureSections();

   string armTxt="OFF";
   color armColor=clrSilver;
   if(g_AutoArm)
   {
      armTxt="AUTO";
      armColor=clrGold;
   }
   else if(g_ArmedMode==ARM_BUY)
   {
      armTxt="BUY";
      armColor=clrLime;
   }
   else if(g_ArmedMode==ARM_SELL)
   {
      armTxt="SELL";
      armColor=clrTomato;
   }
   SetTxt(UI+"ASV",armTxt,armColor);

   int armedSecs=0;
   if((g_ArmedMode!=ARM_NONE || g_AutoArm) && g_ArmMinSignalTime>0)
   {
      long elapsed=(long)(TimeCurrent()-g_ArmMinSignalTime);
      if(elapsed<0)
         elapsed=0;
      armedSecs=(int)elapsed;
   }
   string timerTxt=StringFormat("%02d:%02d:%02d",armedSecs/3600,(armedSecs%3600)/60,armedSecs%60);
   SetTxt(UI+"ATV",timerTxt,clrWhite);

   SetTxt(UI+"BIASV",CandleCloseTimerText(),clrDeepSkyBlue);
   SetTxt(UI+"CONFV",score>=6 ? "YES" : "NO",score>=6 ? clrLime : clrSilver);

   SetTxt(UI+"QUALV",IntegerToString(score)+" / 8",QualityColor(score));
   SetTxt(UI+"QUALS",score>=6 ? QualityText(score)+" QUALITY" : "WAITING",QualityColor(score));

   SetTxt(UI+"RISKAMT",ClipText(RiskPreviewText(),54),C'120,135,165');
   SetTxt(UI+"RRV","1:"+DoubleToString(EffectiveRR(),1),clrWhite);
   SetTxt(UI+"RRTXT","TP "+DoubleToString(EffectiveRR(),1)+"R | SL model",C'120,135,165');

   if(g_PC_On && hasPos)
   {
      string pc="Partials watching";
      if(g_PC3_Done)
         pc="PC1+PC2+PC3 done";
      else if(g_PC2_Done)
         pc="PC1+PC2 done";
      else if(g_PC1_Done)
         pc="PC1 done";
      SetTxt(UI+"PCSTAT",pc,clrGold);
   }
   else
   {
      SetTxt(UI+"PCSTAT",g_PC_On ? "Partials ready" : "Partials OFF",g_PC_On ? clrSkyBlue : clrGray);
   }

   if(hasPos)
   {
      bool isBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
      double entry=PositionGetDouble(POSITION_PRICE_OPEN);
      double sl=PositionGetDouble(POSITION_SL);
      double tp=PositionGetDouble(POSITION_TP);
      double profit=PositionGetDouble(POSITION_PROFIT);
      double vol=PositionGetDouble(POSITION_VOLUME);

      SetTxt(UI+"P1V","OPEN",C'190,95,255');
      SetTxt(UI+"P2V",isBuy ? "BUY" : "SELL",isBuy ? clrLime : clrTomato);
      SetTxt(UI+"P3V",DoubleToString(vol,VolumeDigits()),clrWhite);
      SetTxt(UI+"P4V",DoubleToString(rr,2)+"R",profit>=0.0 ? clrLime : clrTomato);
      SetTxt(UI+"P4M",SignedMoneyText(profit),profit>=0.0 ? clrLime : clrTomato);
      SetTxt(UI+"P5V",PriceText(entry),clrWhite);
      SetTxt(UI+"P6V",PriceText(sl),clrOrangeRed);
      SetTxt(UI+"P7V",PriceText(tp),clrSpringGreen);
      SetTxt(UI+"RRP2",DoubleToString(rr,2)+"R/"+DoubleToString(EffectiveRR(),2)+"R",clrWhite);
      SetTxt(UI+"RRP3",DoubleToString(rrPct,0)+"%",rr>=0.0 ? clrLime : clrTomato);
   }
   else
   {
      SetTxt(UI+"P1V","NONE",clrGray);
      SetTxt(UI+"P2V","---",clrGray);
      SetTxt(UI+"P3V","---",clrGray);
      SetTxt(UI+"P4V","0.00R",clrGray);
      SetTxt(UI+"P4M","$0.00",clrGray);
      SetTxt(UI+"P5V","---",clrGray);
      SetTxt(UI+"P6V","---",clrGray);
      SetTxt(UI+"P7V","---",clrGray);
      SetTxt(UI+"RRP2","0.00R/"+DoubleToString(EffectiveRR(),2)+"R",clrWhite);
      SetTxt(UI+"RRP3","0%",clrWhite);
   }

   double winRate=(totalTrades>0 ? (double)wins*100.0/(double)totalTrades : 0.0);
   double profitFactor=(grossLoss>0.0 ? grossProfit/grossLoss : (grossProfit>0.0 ? 99.0 : 0.0));
   SetTxt(UI+"S1_V",IntegerToString(totalTrades),clrWhite);
   SetTxt(UI+"S2_V",DoubleToString(winRate,2)+"%",winRate>=50.0 ? clrLime : clrTomato);
   SetTxt(UI+"S3_V",IntegerToString(wins),clrLime);
   SetTxt(UI+"S4_V",IntegerToString(losses),clrTomato);
   SetTxt(UI+"S5_V",SignedMoneyText(openPL),openPL>=0.0 ? clrDeepSkyBlue : clrTomato);
   SetTxt(UI+"S6_V",SignedMoneyText(totalNet),totalNet>=0.0 ? clrLime : clrTomato);
   SetTxt(UI+"S7_V",DoubleToString(profitFactor,2),profitFactor>=1.0 ? clrDeepSkyBlue : clrTomato);
   SetTxt(UI+"S8_V","--",clrTomato);

   SetTxt(UI+"MSG",ClipText(g_LastMessage,42),g_LastMsgColor);

   ChartRedraw();
}


//====================================================================
// SUPABASE WEB CONTROL BRIDGE
// React/Supabase -> Edge Function command queue -> This EA
// This block does not change the algo. It only calls the same internal
// functions used by your MT5 panel buttons.
//====================================================================
void RefreshLotEdit();
void RefreshRiskEdit();

string TCX_TrimRightSlash(string url)
{
   string out=url;
   StringTrimLeft(out);
   StringTrimRight(out);
   while(StringLen(out)>0 && StringSubstr(out,StringLen(out)-1,1)=="/")
      out=StringSubstr(out,0,StringLen(out)-1);
   return out;
}

string TCX_JsonEscape(string s)
{
   StringReplace(s,"\\","\\\\");
   StringReplace(s,"\"","\\\"");
   StringReplace(s,"\r"," ");
   StringReplace(s,"\n"," ");
   StringReplace(s,"\t"," ");
   return s;
}

string TCX_BoolText(bool v)
{
   return v ? "true" : "false";
}

string TCX_CommandStatusText()
{
   if(HasOurPosition()) return "POSITION OPEN";
   if(g_AutoArm) return "AUTO WAIT";
   if(g_ArmedMode==ARM_BUY) return "BUY WAIT";
   if(g_ArmedMode==ARM_SELL) return "SELL WAIT";
   return "IDLE";
}

string TCX_ArmText()
{
   if(g_AutoArm) return "AUTO";
   if(g_ArmedMode==ARM_BUY) return "BUY";
   if(g_ArmedMode==ARM_SELL) return "SELL";
   return "OFF";
}

string TCX_PositionJson()
{
   if(!SelectOurPosition())
      return "{\"hasPosition\":false}";

   bool isBuy=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY);
   double entry=PositionGetDouble(POSITION_PRICE_OPEN);
   double sl=PositionGetDouble(POSITION_SL);
   double tp=PositionGetDouble(POSITION_TP);
   double profit=PositionGetDouble(POSITION_PROFIT);
   double vol=PositionGetDouble(POSITION_VOLUME);
   double rr=CurrentPositionRR();

   return "{\"hasPosition\":true"
          +",\"type\":\""+(isBuy ? "BUY" : "SELL")+"\""
          +",\"volume\":"+DoubleToString(vol,VolumeDigits())
          +",\"entry\":"+DoubleToString(entry,_Digits)
          +",\"sl\":"+DoubleToString(sl,_Digits)
          +",\"tp\":"+DoubleToString(tp,_Digits)
          +",\"profit\":"+DoubleToString(profit,2)
          +",\"rr\":"+DoubleToString(rr,2)
          +"}";
}

string TCX_CandleRowJson(string label,ENUM_TIMEFRAMES tf,int shift)
{
   bool above=false;
   bool valid=PriceAboveOpen(tf,shift,above);
   return "{\"label\":\""+TCX_JsonEscape(label)+"\",\"valid\":"+TCX_BoolText(valid)+",\"bull\":"+TCX_BoolText(valid && above)+"}";
}

string TCX_SweepRowJson(string label,bool valid,bool high,bool low)
{
   return "{\"label\":\""+TCX_JsonEscape(label)+"\",\"valid\":"+TCX_BoolText(valid)+",\"high\":"+TCX_BoolText(valid && high)+",\"low\":"+TCX_BoolText(valid && low)+"}";
}

string TCX_StructureJson()
{
   int shOdd=-1, shEven=-1;
   bool oddValid=LatestH4ShiftByParity(true,shOdd);
   bool evenValid=LatestH4ShiftByParity(false,shEven);
   bool hi=false,lo=false;

   string candles="[";
   candles+=TCX_CandleRowJson("D1",PERIOD_D1,0)+",";
   candles+=TCX_CandleRowJson("H4 Odd",PERIOD_H4,oddValid ? shOdd : 0)+",";
   candles+=TCX_CandleRowJson("H4 Even",PERIOD_H4,evenValid ? shEven : 0)+",";
   candles+=TCX_CandleRowJson("H1",PERIOD_H1,0)+"]";

   string sweeps="[";
   bool valid=StandardSweep(PERIOD_H1,hi,lo);
   sweeps+=TCX_SweepRowJson("H1",valid,hi,lo)+",";
   valid=H4ParitySweep(true,hi,lo);
   sweeps+=TCX_SweepRowJson("H4 Odd",valid,hi,lo)+",";
   valid=H4ParitySweep(false,hi,lo);
   sweeps+=TCX_SweepRowJson("H4 Even",valid,hi,lo)+",";
   valid=StandardSweep(PERIOD_D1,hi,lo);
   sweeps+=TCX_SweepRowJson("D1",valid,hi,lo)+"]";

   return "{\"candles\":"+candles+",\"sweeps\":"+sweeps+"}";
}

string TCX_DealReasonText(long reason)
{
   if(reason==DEAL_REASON_SL) return "SL";
   if(reason==DEAL_REASON_TP) return "TP";
   if(reason==DEAL_REASON_SO) return "Stop out";
   if(reason==DEAL_REASON_EXPERT) return "EA";
   if(reason==DEAL_REASON_CLIENT) return "Manual";
   if(reason==DEAL_REASON_MOBILE) return "Mobile";
   if(reason==DEAL_REASON_WEB) return "Web";
   if(reason==DEAL_REASON_ROLLOVER) return "Rollover";
   if(reason==DEAL_REASON_VMARGIN) return "Variation margin";
   if(reason==DEAL_REASON_SPLIT) return "Split";
   return "Close";
}

string TCX_DealSideText(long entryType,long exitType)
{
   if(entryType==DEAL_TYPE_BUY)
      return "BUY";
   if(entryType==DEAL_TYPE_SELL)
      return "SELL";
   if(exitType==DEAL_TYPE_SELL)
      return "BUY";
   if(exitType==DEAL_TYPE_BUY)
      return "SELL";
   return "--";
}

string TCX_JsonPrice(double price)
{
   if(price<=0.0)
      return "null";
   return DoubleToString(price,_Digits);
}

ulong TCX_FindEntryDeal(long positionId,int exitIndex)
{
   for(int i=exitIndex-1;i>=0;i--)
   {
      ulong deal=HistoryDealGetTicket(i);
      if(deal==0)
         continue;
      if(HistoryDealGetString(deal,DEAL_SYMBOL)!=_Symbol)
         continue;
      if((long)HistoryDealGetInteger(deal,DEAL_MAGIC)!=InpMagic)
         continue;
      if((long)HistoryDealGetInteger(deal,DEAL_POSITION_ID)!=positionId)
         continue;

      long entry=HistoryDealGetInteger(deal,DEAL_ENTRY);
      if(entry==DEAL_ENTRY_IN || entry==DEAL_ENTRY_INOUT)
         return deal;
   }
   return 0;
}

string TCX_TradeHistoryJson(int maxRows)
{
   if(maxRows<=0)
      maxRows=40;
   if(maxRows>100)
      maxRows=100;
   if(!HistorySelect((datetime)0,TimeCurrent()))
      return "[]";

   string json="[";
   int rows=0;
   int total=HistoryDealsTotal();
   for(int i=total-1;i>=0 && rows<maxRows;i--)
   {
      ulong deal=HistoryDealGetTicket(i);
      if(deal==0)
         continue;
      if(HistoryDealGetString(deal,DEAL_SYMBOL)!=_Symbol)
         continue;
      if((long)HistoryDealGetInteger(deal,DEAL_MAGIC)!=InpMagic)
         continue;

      long dealEntry=HistoryDealGetInteger(deal,DEAL_ENTRY);
      if(dealEntry!=DEAL_ENTRY_OUT && dealEntry!=DEAL_ENTRY_INOUT && dealEntry!=DEAL_ENTRY_OUT_BY)
         continue;

      long positionId=(long)HistoryDealGetInteger(deal,DEAL_POSITION_ID);
      ulong entryDeal=TCX_FindEntryDeal(positionId,i);
      long entryType=(entryDeal>0 ? HistoryDealGetInteger(entryDeal,DEAL_TYPE) : -1);
      long exitType=HistoryDealGetInteger(deal,DEAL_TYPE);
      datetime closeTime=(datetime)HistoryDealGetInteger(deal,DEAL_TIME);
      datetime openTime=(entryDeal>0 ? (datetime)HistoryDealGetInteger(entryDeal,DEAL_TIME) : 0);
      double profit=HistoryDealGetDouble(deal,DEAL_PROFIT);
      double swap=HistoryDealGetDouble(deal,DEAL_SWAP);
      double commission=HistoryDealGetDouble(deal,DEAL_COMMISSION);
      double net=profit+swap+commission;
      double sl=HistoryDealGetDouble(deal,DEAL_SL);
      double tp=HistoryDealGetDouble(deal,DEAL_TP);
      if(sl<=0.0 && entryDeal>0)
         sl=HistoryDealGetDouble(entryDeal,DEAL_SL);
      if(tp<=0.0 && entryDeal>0)
         tp=HistoryDealGetDouble(entryDeal,DEAL_TP);

      if(rows>0)
         json+=",";
      json+="{"
            +"\"id\":\""+IntegerToString((long)deal)+"\""
            +",\"positionId\":\""+IntegerToString(positionId)+"\""
            +",\"type\":\""+TCX_DealSideText(entryType,exitType)+"\""
            +",\"volume\":"+DoubleToString(HistoryDealGetDouble(deal,DEAL_VOLUME),VolumeDigits())
            +",\"entryPrice\":"+(entryDeal>0 ? TCX_JsonPrice(HistoryDealGetDouble(entryDeal,DEAL_PRICE)) : "null")
            +",\"exitPrice\":"+TCX_JsonPrice(HistoryDealGetDouble(deal,DEAL_PRICE))
            +",\"sl\":"+TCX_JsonPrice(sl)
            +",\"tp\":"+TCX_JsonPrice(tp)
            +",\"profit\":"+DoubleToString(net,2)
            +",\"grossProfit\":"+DoubleToString(profit,2)
            +",\"swap\":"+DoubleToString(swap,2)
            +",\"commission\":"+DoubleToString(commission,2)
            +",\"openTime\":\""+(openTime>0 ? TCX_JsonEscape(TimeToString(openTime,TIME_DATE|TIME_SECONDS)) : "")+"\""
            +",\"closeTime\":\""+TCX_JsonEscape(TimeToString(closeTime,TIME_DATE|TIME_SECONDS))+"\""
            +",\"openTimeSec\":"+IntegerToString((long)openTime)
            +",\"closeTimeSec\":"+IntegerToString((long)closeTime)
            +",\"reason\":\""+TCX_JsonEscape(TCX_DealReasonText(HistoryDealGetInteger(deal,DEAL_REASON)))+"\""
            +",\"comment\":\""+TCX_JsonEscape(HistoryDealGetString(deal,DEAL_COMMENT))+"\""
            +"}";
      rows++;
   }
   json+="]";
   return json;
}

string TCX_BuildStateJson()
{
   datetime now=TimeCurrent();
   int totalTrades=0,wins=0,losses=0;
   double totalNet=0.0,grossProfit=0.0,grossLoss=0.0;
   CalcDealStats((datetime)0,totalTrades,wins,losses,totalNet,grossProfit,grossLoss);

   int dayTrades=0,dayWins=0,dayLosses=0;
   double dayNet=0.0,dayGrossProfit=0.0,dayGrossLoss=0.0;
   CalcDealStats(DayStart(now),dayTrades,dayWins,dayLosses,dayNet,dayGrossProfit,dayGrossLoss);

   double balance=AccountInfoDouble(ACCOUNT_BALANCE);
   double equity=AccountInfoDouble(ACCOUNT_EQUITY);
   double margin=AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin=AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double riskMoney=NormalizeRiskMoney(g_RiskMoney);
   double dayR=(riskMoney>0.0 ? dayNet/riskMoney : 0.0);
   double remainingR=MathMax(0.0,InpDailyLimitR-MathMax(0.0,-dayR));
   double openPL=OpenProfit();
   int score=QualityScore();
   int sp=CurrentSpreadPoints();
   double winRate=(totalTrades>0 ? (double)wins*100.0/(double)totalTrades : 0.0);
   double profitFactor=(grossLoss>0.0 ? grossProfit/grossLoss : (grossProfit>0.0 ? 99.0 : 0.0));

   return "{"
      +"\"source\":\"mt5-ea\""
      +",\"serverTime\":\""+TCX_JsonEscape(TimeToString(now,TIME_DATE|TIME_SECONDS))+"\""
      +",\"accountLogin\":\""+IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN))+"\""
      +",\"symbol\":\""+TCX_JsonEscape(_Symbol)+"\""
      +",\"period\":\""+TCX_JsonEscape(EnumToString(_Period))+"\""
      +",\"eaOnline\":true"
      +",\"webConnected\":"+TCX_BoolText(g_WebConnected)
      +",\"webError\":\""+TCX_JsonEscape(g_WebLastError)+"\""
      +",\"status\":\""+TCX_CommandStatusText()+"\""
      +",\"arm\":\""+TCX_ArmText()+"\""
      +",\"autoArm\":"+TCX_BoolText(g_AutoArm)
      +",\"advanced\":"+TCX_BoolText(g_AdvancedMode)
      +",\"partialsOn\":"+TCX_BoolText(g_PC_On)
      +",\"qualityScore\":"+IntegerToString(score)
      +",\"qualityText\":\""+QualityText(score)+"\""
      +",\"message\":\""+TCX_JsonEscape(g_LastMessage)+"\""
      +",\"lot\":"+DoubleToString(g_Lot,VolumeDigits())
      +",\"risk\":"+DoubleToString(g_RiskMoney,2)
      +",\"riskPercent\":"+DoubleToString(RiskPercentOfBalance(g_RiskMoney),2)
      +",\"riskMode\":\"money\""
      +",\"rr\":"+DoubleToString(EffectiveRR(),1)
      +",\"pc1\":"+DoubleToString(g_PC1_Pct,1)
      +",\"pc2\":"+DoubleToString(g_PC2_Pct,1)
      +",\"pc3\":"+DoubleToString(g_PC3_Pct,1)
      +",\"spread\":"+IntegerToString(sp)
      +",\"maxSpread\":"+IntegerToString(InpMaxSpreadPoints)
      +",\"spreadBlock\":"+TCX_BoolText(SpreadBlocksTrades() && sp>InpMaxSpreadPoints)
      +",\"balance\":"+DoubleToString(balance,2)
      +",\"equity\":"+DoubleToString(equity,2)
      +",\"margin\":"+DoubleToString(margin,2)
      +",\"freeMargin\":"+DoubleToString(freeMargin,2)
      +",\"currency\":\""+TCX_JsonEscape(AccountInfoString(ACCOUNT_CURRENCY))+"\""
      +",\"openPL\":"+DoubleToString(openPL,2)
      +",\"totalNet\":"+DoubleToString(totalNet,2)
      +",\"totalTrades\":"+IntegerToString(totalTrades)
      +",\"wins\":"+IntegerToString(wins)
      +",\"losses\":"+IntegerToString(losses)
      +",\"winRate\":"+DoubleToString(winRate,2)
      +",\"profitFactor\":"+DoubleToString(profitFactor,2)
      +",\"dayTrades\":"+IntegerToString(dayTrades)
      +",\"dayLosses\":"+IntegerToString(dayLosses)
      +",\"dayLossLimit\":"+IntegerToString(InpDailyLossLimitCount)
      +",\"dayNet\":"+DoubleToString(dayNet,2)
      +",\"dayR\":"+DoubleToString(dayR,2)
      +",\"remainingR\":"+DoubleToString(remainingR,2)
      +",\"session\":\""+TCX_JsonEscape(SessionName())+"\""
      +",\"sessionLeft\":\""+TCX_JsonEscape(SessionTimeLeft())+"\""
      +",\"candleTimer\":\""+TCX_JsonEscape(CandleCloseTimerText())+"\""
      +",\"position\":"+TCX_PositionJson()
      +",\"structure\":"+TCX_StructureJson()
      +",\"tradeHistory\":"+TCX_TradeHistoryJson(50)
      +"}";
}

bool TCX_HttpPostFunction(string functionName,string body,string &response)
{
   response="";
   if(!InpWebControlEnabled) return false;
   string base=TCX_TrimRightSlash(InpSupabaseFunctionsUrl);
   string url=base+"/"+functionName;
   string headers="Content-Type: application/json\r\n";
   char data[];
   char result[];
   string resultHeaders="";
   StringToCharArray(body,data,0,StringLen(body),CP_UTF8);
   ResetLastError();
   int code=WebRequest("POST",url,headers,InpWebTimeoutMs,data,result,resultHeaders);
   if(code<200 || code>=300)
   {
      g_WebLastError=functionName+" HTTP "+IntegerToString(code)+" MT5err "+IntegerToString(GetLastError());
      g_WebConnected=false;
      return false;
   }
   response=CharArrayToString(result,0,-1,CP_UTF8);
   g_WebConnected=true;
   g_WebLastError="";
   return true;
}

string TCX_JsonString(string src,string key,string def="")
{
   string needle="\""+key+"\"";
   int p=StringFind(src,needle);
   if(p<0) return def;
   p=StringFind(src,":",p);
   if(p<0) return def;
   p=StringFind(src,"\"",p+1);
   if(p<0) return def;
   int start=p+1;
   int end=start;
   while(end<StringLen(src))
   {
      string ch=StringSubstr(src,end,1);
      if(ch=="\"" && (end==start || StringSubstr(src,end-1,1)!="\\"))
         break;
      end++;
   }
   if(end<start) return def;
   string v=StringSubstr(src,start,end-start);
   StringReplace(v,"\\\"","\"");
   StringReplace(v,"\\\\","\\");
   return v;
}

double TCX_JsonNumber(string src,string key,double def=0.0)
{
   string needle="\""+key+"\"";
   int p=StringFind(src,needle);
   if(p<0) return def;
   p=StringFind(src,":",p);
   if(p<0) return def;
   int start=p+1;
   while(start<StringLen(src))
   {
      string ch=StringSubstr(src,start,1);
      if(ch!=" " && ch!="\t" && ch!="\r" && ch!="\n") break;
      start++;
   }
   int end=start;
   while(end<StringLen(src))
   {
      string ch=StringSubstr(src,end,1);
      if(StringFind("0123456789+-.",ch)<0) break;
      end++;
   }
   if(end<=start) return def;
   return StringToDouble(StringSubstr(src,start,end-start));
}

void TCX_AckCommand(string id,string status,string message)
{
   if(id=="") return;
   string res="";
   string body="{\"ea_id\":\""+TCX_JsonEscape(InpSupabaseEaId)+"\",\"ea_token\":\""+TCX_JsonEscape(InpSupabaseEaToken)+"\",\"command_id\":\""+TCX_JsonEscape(id)+"\",\"status\":\""+TCX_JsonEscape(status)+"\",\"message\":\""+TCX_JsonEscape(message)+"\"}";
   TCX_HttpPostFunction("ea-ack-command",body,res);
}

bool TCX_ApplyWebCommand(string id,string action,string raw)
{
   if(id!="" && id==g_WebLastCommandId)
      return true;

   StringToUpper(action);
   string msg="";

   if(action=="ARM_BUY")
   {
      SetArmMode(g_ArmedMode==ARM_BUY ? ARM_NONE : ARM_BUY);
      msg=(g_ArmedMode==ARM_BUY ? "WEB BUY armed - waiting for next model" : "WEB BUY wait cancelled");
      SetLastMessage(msg,g_ArmedMode==ARM_BUY ? clrLime : clrSilver);
   }
   else if(action=="ARM_SELL")
   {
      SetArmMode(g_ArmedMode==ARM_SELL ? ARM_NONE : ARM_SELL);
      msg=(g_ArmedMode==ARM_SELL ? "WEB SELL armed - waiting for next model" : "WEB SELL wait cancelled");
      SetLastMessage(msg,g_ArmedMode==ARM_SELL ? clrTomato : clrSilver);
   }
   else if(action=="AUTO_ARM")
   {
      SetAutoArm(!g_AutoArm);
      msg=(g_AutoArm ? "WEB auto arm enabled" : "WEB auto arm disabled");
      SetLastMessage(msg,g_AutoArm ? clrGold : clrSilver);
   }
   else if(action=="CANCEL")
   {
      SetArmMode(ARM_NONE);
      g_AutoArm=false;
      msg="WEB waiting mode cancelled";
      SetLastMessage(msg,clrSilver);
   }
   else if(action=="CLOSE" || action=="CLOSE_ALL")
   {
      if(!InpWebAllowCloseCommands)
      {
         msg="WEB close blocked by input setting";
         SetLastMessage(msg,clrTomato);
         return false;
      }
      CloseAllPositions();
      msg="WEB close command processed";
   }
   else if(action=="CLOSE_50")
   {
      if(!InpWebAllowCloseCommands)
      {
         msg="WEB close 50 blocked by input setting";
         SetLastMessage(msg,clrTomato);
         return false;
      }
      CloseCurrentPercent(50.0);
      msg="WEB close 50 processed";
   }
   else if(action=="BREAK_EVEN" || action=="BE")
   {
      MoveToBreakEven();
      msg="WEB break even processed";
   }
   else if(action=="TOGGLE_PARTIALS")
   {
      g_PC_On=!g_PC_On;
      msg=(g_PC_On ? "WEB partial close enabled" : "WEB partial close disabled");
      SetLastMessage(msg,g_PC_On ? clrSkyBlue : clrSilver);
   }
   else if(action=="SET_MODE")
   {
      string mode=TCX_JsonString(raw,"mode","safe");
      StringToLower(mode);
      if(mode=="advanced" || mode=="adv")
      {
         g_AdvancedMode=true;
         g_PC_On=true;
         msg="WEB advanced mode enabled";
         SetLastMessage(msg,clrSkyBlue);
      }
      else
      {
         g_AdvancedMode=false;
         g_PC_On=false;
         msg="WEB safe mode enabled";
         SetLastMessage(msg,clrSilver);
      }
   }
   else if(action=="SET_RISK")
   {
      double lot=TCX_JsonNumber(raw,"lot",g_Lot);
      double risk=TCX_JsonNumber(raw,"risk",g_RiskMoney);
      double rr=TCX_JsonNumber(raw,"rr",g_RRTarget);
      g_Lot=NormalizeVolumeForPanel(lot);
      g_RiskMoney=NormalizeRiskMoney(risk);
      g_RRTarget=NormalizeDouble(MathMax(0.1,MathMin(20.0,rr)),1);
      RefreshLotEdit();
      RefreshRiskEdit();
      msg="WEB risk updated: lot "+DoubleToString(g_Lot,VolumeDigits())+", risk "+MoneyText(g_RiskMoney)+", RR 1:"+DoubleToString(g_RRTarget,1);
      SetLastMessage(msg,clrSilver);
   }
   else if(action=="SET_PARTIALS")
   {
      g_PC1_Pct=ClampPercent(TCX_JsonNumber(raw,"pc1",g_PC1_Pct));
      g_PC2_Pct=ClampPercent(TCX_JsonNumber(raw,"pc2",g_PC2_Pct));
      g_PC3_Pct=ClampPercent(TCX_JsonNumber(raw,"pc3",g_PC3_Pct));
      SetEditText(E_PC1,g_PC1_Pct,0);
      SetEditText(E_PC2,g_PC2_Pct,0);
      SetEditText(E_PC3,g_PC3_Pct,0);
      msg="WEB partial values updated";
      SetLastMessage(msg,clrSilver);
   }
   else if(action=="PING" || action=="NOOP")
   {
      msg="WEB ping ok";
   }
   else
   {
      msg="Unknown web command: "+action;
      SetLastMessage(msg,clrTomato);
      return false;
   }

   g_WebLastCommandId=id;
   UpdatePanel();
   return true;
}

bool TCX_WebReady()
{
   if(!InpWebControlEnabled)
      return false;
   if(StringLen(InpSupabaseFunctionsUrl)<20 || StringFind(InpSupabaseFunctionsUrl,"YOUR_PROJECT_REF")>=0)
      return false;
   if(StringLen(InpSupabaseEaId)<8 || StringFind(InpSupabaseEaId,"PASTE_EA_ID")>=0)
      return false;
   if(StringLen(InpSupabaseEaToken)<12 || StringFind(InpSupabaseEaToken,"PASTE_EA_SECRET")>=0)
      return false;
   return true;
}

void TCX_SupabasePollCommands()
{
   if(!TCX_WebReady())
      return;

   uint nowTick=GetTickCount();
   int ms=MathMax(300,InpWebPollMilliseconds);
   if(g_WebLastPollTick>0 && (uint)(nowTick-g_WebLastPollTick)<(uint)ms)
      return;
   g_WebLastPollTick=nowTick;

   string res="";
   string body="{\"ea_id\":\""+TCX_JsonEscape(InpSupabaseEaId)+"\",\"ea_token\":\""+TCX_JsonEscape(InpSupabaseEaToken)+"\",\"symbol\":\""+TCX_JsonEscape(_Symbol)+"\",\"magic\":"+IntegerToString(InpMagic)+"}";
   if(!TCX_HttpPostFunction("ea-next-command",body,res))
      return;

   bool hasCommand=(StringFind(res,"\"action\"")>=0 && StringFind(res,"\"id\"")>=0 && StringFind(res,"\"command\":null")<0);
   if(!hasCommand)
      return;

   string id=TCX_JsonString(res,"id","");
   string action=TCX_JsonString(res,"action","");
   if(action=="")
      return;

   bool ok=TCX_ApplyWebCommand(id,action,res);
   TCX_AckCommand(id,ok ? "done" : "failed",g_LastMessage);
}

void TCX_SupabasePostState()
{
   if(!TCX_WebReady() || !InpWebPostLiveState)
      return;

   uint nowTick=GetTickCount();
   if(g_WebLastPostTick>0 && (uint)(nowTick-g_WebLastPostTick)<1000)
      return;
   g_WebLastPostTick=nowTick;

   string res="";
   string body="{\"ea_id\":\""+TCX_JsonEscape(InpSupabaseEaId)+"\",\"ea_token\":\""+TCX_JsonEscape(InpSupabaseEaToken)+"\",\"state\":"+TCX_BuildStateJson()+"}";
   TCX_HttpPostFunction("ea-post-state",body,res);
}

void EnsurePanel()
{
   if(!g_PanelBuilt || ObjectFind(0,UI+"BG")<0 || ObjectFind(0,B_BUY)<0 || ObjectFind(0,B_SELL)<0)
   {
      BuildPanel();
      UpdatePanel();
   }
}

void RuntimeLoop(bool allowTradeScan)
{
   EnsurePanel();
   SyncPositionState();
   TCX_SupabasePollCommands();

   if(g_PC_On)
      MonitorPartialClose();

   datetime barTime=iTime(_Symbol,_Period,0);
   if(barTime!=g_LastBarTime)
   {
      g_LastBarTime=barTime;
      DrawLatestClosedSignal();
   }

   // Check armed execution EVERY tick so spread filter doesn't permanently block
   if(allowTradeScan && (g_ArmedMode!=ARM_NONE || g_AutoArm))
      TryArmedExecution();

   UpdatePanel();
   TCX_SupabasePostState();
   ChartHeartbeat();
}

//====================================================================
// EDIT HANDLERS
//====================================================================
void RefreshLotEdit()
{
   if(ObjectFind(0,E_LOT)>=0)
      ObjectSetString(0,E_LOT,OBJPROP_TEXT,DoubleToString(g_Lot,VolumeDigits()));
}

void RefreshRiskEdit()
{
   if(ObjectFind(0,E_RISK)>=0)
      ObjectSetString(0,E_RISK,OBJPROP_TEXT,DoubleToString(g_RiskMoney,2));
}

void HandleLotEdit()
{
   string raw=ObjectGetString(0,E_LOT,OBJPROP_TEXT);

   double maxLot=InpPanelLotMax;
   if(maxLot<=0.0)
      maxLot=100.0;
   if(InpClampLotToBrokerMax)
      maxLot=MathMin(maxLot,BrokerMaxLot());

   g_Lot=NormalizeVolumeForPanel(CleanNumber(raw,g_Lot,BrokerMinLot(),maxLot));
   RefreshLotEdit();
   SetLastMessage("Lot set to "+DoubleToString(g_Lot,VolumeDigits()),clrSilver);
   UpdatePanel();
}

void HandleRiskEdit()
{
   string raw=ObjectGetString(0,E_RISK,OBJPROP_TEXT);
   g_RiskMoney=CleanMoney(raw,g_RiskMoney);
   RefreshRiskEdit();
   SetLastMessage("Risk set to "+MoneyText(g_RiskMoney),clrSilver);
   UpdatePanel();
}

void HandlePartialEdit(string obj)
{
   string raw=ObjectGetString(0,obj,OBJPROP_TEXT);

   if(obj==E_PC1)
   {
      g_PC1_Pct=CleanPercent(raw,g_PC1_Pct);
      SetEditText(E_PC1,g_PC1_Pct,0);
   }
   else if(obj==E_PC2)
   {
      g_PC2_Pct=CleanPercent(raw,g_PC2_Pct);
      SetEditText(E_PC2,g_PC2_Pct,0);
   }
   else if(obj==E_PC3)
   {
      g_PC3_Pct=CleanPercent(raw,g_PC3_Pct);
      SetEditText(E_PC3,g_PC3_Pct,0);
   }

   SetLastMessage("Partial book values updated",clrSilver);
   UpdatePanel();
}

//====================================================================
// EVENTS
//====================================================================
int OnInit()
{
   g_InitTime=TimeCurrent();
   SymbolSelect(_Symbol,true);

   g_Lot=NormalizeVolumeForPanel(InpLot);
   g_RRTarget=(InpRiskReward>0.0 ? InpRiskReward : 3.0);
   g_RiskMoney=NormalizeRiskMoney(InpRiskMoney);
   g_PC_On=InpPartialCloseEnabled;
   g_AdvancedMode=InpPartialCloseEnabled;
   g_PC1_Pct=ClampPercent(InpPC1_Percent);
   g_PC2_Pct=ClampPercent(InpPC2_Percent);
   g_PC3_Pct=ClampPercent(InpPC3_Percent);

   Trade.SetExpertMagicNumber(InpMagic);
   Trade.SetDeviationInPoints(InpDeviationPoints);
   Trade.SetMarginMode();
   Trade.SetTypeFillingBySymbol(_Symbol);

   g_LastBarTime=0;  // Force pattern check on first tick

   DeleteTradeLevelObjects();
   BuildPanel();
   ChartHeartbeat();
   SyncPositionState();
   DrawHistoricalSignals();
   UpdatePanel();

   SetLastMessage("Controller ready - buttons wait for next model, spread no block",clrSilver);
   UpdatePanel();
   if(InpWebControlEnabled)
      EventSetMillisecondTimer(MathMax(300,InpWebPollMilliseconds));
   else
      EventSetTimer(1);
   ChartRedraw();

   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
   ObjectsDeleteAll(0,PX);
   ChartRedraw();
}

void OnTick()
{
   RuntimeLoop(true);
}

void OnTimer()
{
   RuntimeLoop(false);
}

void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
   if(id==CHARTEVENT_CHART_CHANGE)
   {
      BuildPanel();
      UpdatePanel();
      return;
   }

   if(id==CHARTEVENT_OBJECT_ENDEDIT)
   {
      if(sparam==E_LOT)
      {
         HandleLotEdit();
         return;
      }
      if(sparam==E_RISK)
      {
         HandleRiskEdit();
         return;
      }
      if(sparam==E_PC1 || sparam==E_PC2 || sparam==E_PC3)
      {
         HandlePartialEdit(sparam);
         return;
      }
   }

   if(id!=CHARTEVENT_OBJECT_CLICK)
      return;

   if(ObjectFind(0,sparam)>=0)
      ObjectSetInteger(0,sparam,OBJPROP_STATE,false);

   if(sparam==B_BUY)
   {
      SetArmMode(g_ArmedMode==ARM_BUY ? ARM_NONE : ARM_BUY);
      SetLastMessage(g_ArmedMode==ARM_BUY ? "BUY armed - waiting for next model" : "BUY wait cancelled",
                     g_ArmedMode==ARM_BUY ? clrLime : clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_SELL)
   {
      SetArmMode(g_ArmedMode==ARM_SELL ? ARM_NONE : ARM_SELL);
      SetLastMessage(g_ArmedMode==ARM_SELL ? "SELL armed - waiting for next model" : "SELL wait cancelled",
                     g_ArmedMode==ARM_SELL ? clrTomato : clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_AUTO)
   {
      SetAutoArm(!g_AutoArm);
      SetLastMessage(g_AutoArm ? "Auto arm enabled - waiting for next model" : "Auto arm disabled",
                     g_AutoArm ? clrGold : clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_CANCEL)
   {
      SetArmMode(ARM_NONE);
      g_AutoArm=false;
      SetLastMessage("Waiting mode cancelled",clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_CLOSE || sparam==B_CLOSE_ALL)
   {
      CloseAllPositions();
      UpdatePanel();
      return;
   }

   if(sparam==B_CLOSE50)
   {
      CloseCurrentPercent(50.0);
      UpdatePanel();
      return;
   }

   if(sparam==B_BE)
   {
      MoveToBreakEven();
      UpdatePanel();
      return;
   }

   if(sparam==B_PC)
   {
      g_PC_On=!g_PC_On;
      SetLastMessage(g_PC_On ? "Partial close enabled" : "Partial close disabled",
                     g_PC_On ? clrSkyBlue : clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_MODE_SAFE)
   {
      g_AdvancedMode=false;
      g_PC_On=false;
      SetLastMessage("Safe mode: fixed TP, no partials",clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_MODE_ADV)
   {
      g_AdvancedMode=true;
      g_PC_On=true;
      SetLastMessage("Advanced mode: partials and BE controls ready",clrSkyBlue);
      UpdatePanel();
      return;
   }

   if(sparam==B_LOT_UP)
   {
      double step=InpLotButtonStep;
      if(step<=0.0)
         step=BrokerStepLot();
      g_Lot=NormalizeVolumeForPanel(g_Lot+step);
      RefreshLotEdit();
      SetLastMessage("Lot set to "+DoubleToString(g_Lot,VolumeDigits()),clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_LOT_DN)
   {
      double step=InpLotButtonStep;
      if(step<=0.0)
         step=BrokerStepLot();
      g_Lot=NormalizeVolumeForPanel(g_Lot-step);
      RefreshLotEdit();
      SetLastMessage("Lot set to "+DoubleToString(g_Lot,VolumeDigits()),clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_RISK_UP)
   {
      double step=InpRiskMoneyButtonStep;
      if(step<=0.0)
         step=10.0;
      g_RiskMoney=NormalizeRiskMoney(g_RiskMoney+step);
      RefreshRiskEdit();
      SetLastMessage("Risk set to "+MoneyText(g_RiskMoney),clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_RISK_DN)
   {
      double step=InpRiskMoneyButtonStep;
      if(step<=0.0)
         step=10.0;
      g_RiskMoney=NormalizeRiskMoney(g_RiskMoney-step);
      RefreshRiskEdit();
      SetLastMessage("Risk set to "+MoneyText(g_RiskMoney),clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_RR_UP)
   {
      g_RRTarget=MathMin(20.0,g_RRTarget+0.1);
      g_RRTarget=NormalizeDouble(g_RRTarget,1);
      SetLastMessage("RR target set to 1:"+DoubleToString(g_RRTarget,1),clrSilver);
      UpdatePanel();
      return;
   }

   if(sparam==B_RR_DN)
   {
      g_RRTarget=MathMax(0.1,g_RRTarget-0.1);
      g_RRTarget=NormalizeDouble(g_RRTarget,1);
      SetLastMessage("RR target set to 1:"+DoubleToString(g_RRTarget,1),clrSilver);
      UpdatePanel();
      return;
   }
}
//+------------------------------------------------------------------+
