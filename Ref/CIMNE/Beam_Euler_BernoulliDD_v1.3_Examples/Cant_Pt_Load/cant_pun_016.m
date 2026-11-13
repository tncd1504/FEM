%=======================================================================
% MAT-fem_Beams 1.0  - MAT-fem is a learning tool for undestanding 
%                      the Finite Element Method with MATLAB and GiD
%=======================================================================
% PROBLEM TITLE = Untitled
%
%  Material Properties
%
  young  =   2.000000000e+08 ;
  poiss  =  2.000000000e-01 ;
  denss  =   0.000000000e+00 ;
  area   =   1.000000000e-02 ;
  inertia=   8.333330000e-06 ;
%
% Coordinates
%
global coordinates
coordinates = [
   1.000000000e+01   ;
   9.375000000e+00   ;
   8.750000000e+00   ;
   8.125000000e+00   ;
   7.500000000e+00   ;
   6.875000000e+00   ;
   6.250000000e+00   ;
   5.625000000e+00   ;
   5.000000000e+00   ;
   4.375000000e+00   ;
   3.750000000e+00   ;
   3.125000000e+00   ;
   2.500000000e+00   ;
   1.875000000e+00   ;
   1.250000000e+00   ;
   6.250000000e-01   ;
   0.000000000e+00   ] ; 
%
% Elements
%
global elements
elements = [
     17   ,     16   ; 
     16   ,     15   ; 
     15   ,     14   ; 
     14   ,     13   ; 
     13   ,     12   ; 
     12   ,     11   ; 
     11   ,     10   ; 
     10   ,      9   ; 
      9   ,      8   ; 
      8   ,      7   ; 
      7   ,      6   ; 
      6   ,      5   ; 
      5   ,      4   ; 
      4   ,      3   ; 
      3   ,      2   ; 
      2   ,      1   ] ; 
%
% Fixed Nodes
%
fixnodes = [
     17  , 1 ,   0.000000000e+00  ;
     17  , 2 ,   0.000000000e+00  ] ;
%
% Point loads
%
pointload = [
      1  , 1 ,  -5.000000000e+00  ;
      1  , 2 ,   0.000000000e+00  ] ;
%
% Side loadsss
%
uniload = sparse ( 16 , 1 );



