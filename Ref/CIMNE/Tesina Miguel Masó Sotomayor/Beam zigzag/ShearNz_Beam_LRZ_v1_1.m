function [shrStr coor_z] = ShearNz_Beam_LRZ_v1_1 (young,zlayr,lStrNod)
% This script integrates shear stress from const. eq.

  global coordinates;
  global elements;

  nlayr  = size(young,1);
  nelem  = size(elements,1);          % Number of elements
  nnode  = size(elements,2);          % Number of nodes por element
  npnod  = size(coordinates,1);       % Number of nodes
  dofpn  = 4;                         % Number of DOF per node
  npz    = 50;                        % number of points per layer
  shrStr = zeros(npnod,npz*nlayr,2);  % Create array for shear stresses

%% Vertical coordinate
  coor_z = zeros(npz*nlayr,1);
  for k = 1 : nlayr
    coor_z(npz*(k-1)+1:npz*k) = linspace(zlayr(k),zlayr(k+1),npz);
  end

%% Normal stresses integration
  Nz = zeros(npnod,npz*nlayr);
  for i = 1 : npnod
    for k = 1 : nlayr
      Nz(i,npz*(k-1)+1:npz*k) = ...
        linspace(lStrNod(i,1,2*(k-1)+1),lStrNod(i,1,2*(k-1)+2),npz);
    end
    Nz(i,:) = cumtrapz(coor_z,Nz(i,:));
  end

%% Normal stresses derivative
  % Element cycle.
  for ielem = 1 : nelem

    lnods(1:nnode) = elements(ielem,1:nnode);

    coor_x(1:nnode) = coordinates(lnods(1:nnode),1); % Elem. X coordinate

    len = coor_x(2) - coor_x(1);  % x_j > x_i

    diffNz = (Nz(lnods(2),:) - Nz(lnods(1),:))/len;

    shrStr(lnods(1),:,1) = shrStr(lnods(1),:,1) - diffNz;
    shrStr(lnods(2),:,1) = shrStr(lnods(2),:,1) - diffNz;
    shrStr(lnods(1),:,2) = shrStr(lnods(1),:,2) + 1;
    shrStr(lnods(2),:,2) = shrStr(lnods(2),:,2) + 1;

  end

  for i = 1 : npnod
    shrStr(i,:,1) = shrStr(i,:,1)./shrStr(i,:,2);
  end
  
  